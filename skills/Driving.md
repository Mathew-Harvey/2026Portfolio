# Top-Down Driving Physics — Art of Rally Style

## Reference Guide for Implementing Satisfying Arcade-Sim Car Physics

This document teaches you how to implement car physics that feel like **Art of Rally** — the acclaimed top-down/isometric rally game by Funselektor Labs. The goal is a system that is **physically grounded but gameplay-first**: cars that drift satisfyingly, grip believably, and reward real driving techniques like Scandinavian flicks, left-foot braking, counter-steering, and handbrake turns — all from a top-down camera perspective.

---

## 1. Philosophy: What Makes Art of Rally Feel Good

Art of Rally sits in a specific sweet spot:

- It is **not** a pure arcade game (velocity ≠ facing direction; you can't just point-and-go).
- It is **not** a simulation (no Pacejka tyre curves with 15 coefficients, no suspension travel).
- It uses a **simplified bicycle model** with real slip angle physics, but with aggressive arcade-friendly clamping and tuning.

The key principles:

1. **Cars have mass and inertia** — they resist changes in direction and rotation.
2. **Tyres generate lateral forces from slip angles** — the angle between where a wheel points and where it's actually moving determines cornering force.
3. **Grip is finite and surface-dependent** — gravel, tarmac, snow, and rain each change the available grip.
4. **Drifting emerges naturally** from exceeding grip limits, not from a "drift button."
5. **The handbrake reduces rear grip** to initiate rotation, not to brake the car.
6. **Weight transfer shifts grip between axles** — braking loads the front, accelerating loads the rear.
7. **Cornering force is capped, never reduced** past the peak slip angle — this is the critical arcade-friendly simplification that keeps the player in control even during wild slides.
8. **Steering angle decreases with speed** — like a real car, small inputs at speed, large inputs at low speed.

---

## 2. Core Architecture: The Bicycle Model

The entire car is simplified to **two virtual wheels** — one front axle, one rear axle — positioned along the car's longitudinal axis. This is called the **bicycle model** and is the foundation used by Marco Monster's famous car physics paper and derivatives.

### State Variables

```
Car State:
  position        : vec2    — world position of the car's centre of gravity (CG)
  velocity        : vec2    — world-space velocity vector
  heading         : float   — angle the car body is facing (radians)
  angularVelocity : float   — yaw rate (radians/sec) — how fast the car is spinning
  steerAngle      : float   — current front wheel angle relative to car body

Constants / Tuning:
  mass            : float   — kg (e.g. 1200)
  inertia         : float   — moment of inertia for yaw (kg·m², typically ≈ mass)
  halfLength      : float   — distance from CG to front/rear axle (can differ: cgToFront, cgToRear)
  cgToFront       : float   — distance from CG to front axle (e.g. 1.2m)
  cgToRear        : float   — distance from CG to rear axle (e.g. 1.2m)
  wheelBase       : float   — cgToFront + cgToRear
  maxSteerAngle   : float   — maximum steering angle (radians, e.g. 0.5)
  cornerStiffF    : float   — front cornering stiffness (e.g. 5.0)
  cornerStiffR    : float   — rear cornering stiffness (e.g. 5.2)
  maxGrip         : float   — maximum lateral force coefficient (e.g. 2.0)
```

### Coordinate Frames

Always work in **two frames**:

- **World space** — for position, rendering, collision.
- **Car-local space** — for physics calculations. X = forward along car heading, Y = right/lateral.

Transform world velocity to local:

```
localVel.x =  cos(heading) * velocity.x + sin(heading) * velocity.y
localVel.y = -sin(heading) * velocity.x + cos(heading) * velocity.y
```

`localVel.x` is **forward speed**, `localVel.y` is **lateral speed** (sideways sliding).

---

## 3. The Physics Step (Every Frame)

Execute these steps in order every physics tick (use a fixed timestep, e.g. 1/60s or 1/120s):

### Step 1: Transform Velocity to Local Space

```
speed = length(velocity)
if speed < 0.001:
    localVel = vec2(0, 0)
else:
    localVel.x =  cos(heading) * velocity.x + sin(heading) * velocity.y
    localVel.y = -sin(heading) * velocity.x + cos(heading) * velocity.y
```

### Step 2: Calculate Slip Angles

Slip angles determine how much the tyres are being pushed sideways relative to their rolling direction. This is the **heart of the model**.

```
# Wheel velocities include contribution from car's angular rotation
# (the yaw rate makes front/rear wheels move sideways at different rates)

# Front axle lateral velocity (car yaw contributes forward offset)
frontSlipAngle = atan2(localVel.y + angularVelocity * cgToFront, abs(localVel.x))
                 - sign(localVel.x) * steerAngle

# Rear axle lateral velocity
rearSlipAngle  = atan2(localVel.y - angularVelocity * cgToRear,  abs(localVel.x))
```

**Key insight**: The `angularVelocity * distance` term accounts for how the car's rotation pushes each axle sideways. The front axle sweeps outward when the car yaws, the rear sweeps inward. This is what creates natural understeer/oversteer behavior.

### Step 3: Calculate Lateral (Cornering) Forces

This is where Art of Rally diverges from simulation. Instead of a full Pacejka curve (which rises to a peak then drops), use a **linear function clamped to a maximum**:

```
# CRITICAL: Cap the force, don't let it decrease past peak.
# This is the key arcade-friendly simplification.

frontLateralForce = clamp(-cornerStiffF * frontSlipAngle, -maxGrip, maxGrip)
rearLateralForce  = clamp(-cornerStiffR * rearSlipAngle,  -maxGrip, maxGrip)
```

**Why capping matters**: In reality, tyres lose grip past their peak slip angle (the Pacejka curve drops off). In a game, this makes spins unrecoverable — the more you slide, the less grip you have, so you slide more. Capping the force means that even at extreme angles, the player retains a constant restoring force, making recovery always possible with skill.

Optionally, scale by weight on each axle (see weight transfer in Step 4).

### Step 4: Weight Transfer (Simplified)

Weight shifts forward under braking and rearward under acceleration. This changes grip per axle:

```
# Static weight distribution (assuming CG is centered)
weightFront = mass * 0.5     # or mass * (cgToRear / wheelBase)
weightRear  = mass * 0.5     # or mass * (cgToFront / wheelBase)

# Dynamic transfer from longitudinal acceleration
# accelerationLongitudinal is the current forward/backward accel applied
weightTransfer = (accelerationLongitudinal * mass * cgHeight) / wheelBase

weightFront += weightTransfer   # braking adds weight to front
weightRear  -= weightTransfer   # braking removes weight from rear

# Scale lateral forces by normalized weight
frontLateralForce *= weightFront / (mass * 0.5)
rearLateralForce  *= weightRear  / (mass * 0.5)
```

This gives you **lift-off oversteer** (release throttle → weight shifts forward → rear loses grip → tail slides out) and **power understeer** for free.

### Step 5: Longitudinal Forces (Throttle, Braking, Drag)

Keep this simple — Art of Rally doesn't simulate engine torque curves or gear ratios in a way the player perceives:

```
# Traction force from throttle/brake input (-1 to +1)
if throttleInput > 0:
    tractionForce = throttleInput * engineForce
else:
    tractionForce = throttleInput * brakeForce

# Air resistance (quadratic)
dragForce = -dragCoeff * localVel.x * abs(localVel.x)

# Rolling resistance (linear, low speed)
rollingResistance = -rollResistCoeff * localVel.x

# Total longitudinal force
totalLongForce = tractionForce + dragForce + rollingResistance
```

Suggested values:
- `engineForce` ≈ 6000–10000 N
- `brakeForce` ≈ 8000–12000 N
- `dragCoeff` ≈ 2.0–5.0
- `rollResistCoeff` ≈ 30.0

### Step 6: Compose Forces and Apply

```
# Total force in car-local space
localForce.x = totalLongForce
localForce.y = cos(steerAngle) * frontLateralForce + rearLateralForce

# Yaw torque — front and rear lateral forces create a torque around CG
torque = cgToFront * cos(steerAngle) * frontLateralForce
       - cgToRear * rearLateralForce

# Convert local force to world space
worldForce.x = cos(heading) * localForce.x - sin(heading) * localForce.y
worldForce.y = sin(heading) * localForce.x + cos(heading) * localForce.y

# Integrate (Euler is fine for arcade; use RK4 for stability at high speeds)
acceleration = worldForce / mass
velocity += acceleration * dt
position += velocity * dt

angularAcceleration = torque / inertia
angularVelocity += angularAcceleration * dt
heading += angularVelocity * dt
```

### Step 7: Low-Speed Stability Patch

At very low speeds the slip angle calculations become unstable (division by near-zero forward speed). Apply these fixes:

```
# Dampen angular velocity when nearly stopped
if abs(localVel.x) < 0.5:
    angularVelocity *= 0.9   # heavy damping

# Kill micro-velocities to prevent jitter
if speed < 0.1 and abs(throttleInput) < 0.01:
    velocity = vec2(0, 0)
    angularVelocity = 0
```

---

## 4. The Handbrake

The handbrake is essential for rally driving. It works by **reducing rear tyre grip**, not by slowing the car:

```
if handbrakeActive:
    rearLateralForce *= handbrakeGripMultiplier   # e.g. 0.1 to 0.3
    # Optionally also apply some longitudinal braking on rear
    # to slow the car slightly:
    rearBrakeForce = -handbrakeDeceleration * sign(localVel.x)
```

This causes the rear to lose lateral grip while the front retains it, creating a pivot around the front axle — the classic handbrake turn.

**Tuning tip**: `handbrakeGripMultiplier` of 0.2 gives a strong snap; 0.4 is more gradual. Art of Rally leans toward the snappy side.

---

## 5. Surface Types and Grip Multipliers

Different surfaces scale the maximum grip available:

```
Surface Grip Table (multiply maxGrip by these):
  Tarmac (dry)    : 1.0
  Tarmac (wet)    : 0.7
  Gravel          : 0.6
  Dirt             : 0.55
  Snow             : 0.3
  Ice              : 0.15
  Grass            : 0.4
  Mud              : 0.35
```

Apply the surface multiplier to BOTH `frontLateralForce` and `rearLateralForce`, and also to the traction force (reduce engine grip on slippery surfaces):

```
frontLateralForce *= surfaceGrip
rearLateralForce  *= surfaceGrip
tractionForce = min(tractionForce, maxTractionForce * surfaceGrip)
```

On gravel and snow, the car should naturally feel **more slidey** — requiring earlier braking, smoother inputs, and more counter-steering. This emerges from the physics, no special code needed beyond the grip multiplier.

---

## 6. Steering Model

### Speed-Sensitive Steering Angle

At high speed, reduce the maximum steering angle. This prevents unrealistic snapping at speed and mimics real driving:

```
speedFactor = 1.0 - clamp(speed / maxSpeed, 0, 1) * 0.7
effectiveMaxSteer = maxSteerAngle * speedFactor
```

### Steering Rate (Smoothing)

Don't snap the steering angle — smooth it:

```
targetSteer = steerInput * effectiveMaxSteer

# Interpolate toward target
steerRate = 3.0   # radians per second (tune this)
if abs(targetSteer - steerAngle) < steerRate * dt:
    steerAngle = targetSteer
else:
    steerAngle += sign(targetSteer - steerAngle) * steerRate * dt
```

### Auto-Centring

When no steering input is given, return wheels to centre:

```
if abs(steerInput) < 0.01:
    centreRate = 5.0
    steerAngle -= steerAngle * centreRate * dt
```

---

## 7. Drivetrain Types

Art of Rally features FWD, RWD, and AWD cars that feel distinctly different:

### RWD (Rear Wheel Drive)
- Engine force applied only to rear axle.
- Throttle-on in a corner → rear breaks traction → power oversteer.
- Classic drift car feel.
```
rearTractionForce = throttleInput * engineForce
frontTractionForce = 0
```

### FWD (Front Wheel Drive)
- Engine force applied only to front axle.
- Throttle-on in a corner → front breaks traction → understeer.
- Lift-off oversteer is the primary slide initiator.
```
frontTractionForce = throttleInput * engineForce
rearTractionForce = 0
```

### AWD (All Wheel Drive)
- Engine force split between axles (e.g., 40/60 front/rear for rally bias).
- Most forgiving; mild oversteer under power.
```
frontTractionForce = throttleInput * engineForce * 0.4
rearTractionForce  = throttleInput * engineForce * 0.6
```

When traction force is per-axle, you must also limit it by the grip available on that axle's surface contact:

```
maxFrontTraction = weightFront * surfaceGrip * frictionCoeff
maxRearTraction  = weightRear  * surfaceGrip * frictionCoeff
frontTractionForce = clamp(frontTractionForce, -maxFrontTraction, maxFrontTraction)
rearTractionForce  = clamp(rearTractionForce,  -maxRearTraction,  maxRearTraction)
```

---

## 8. Counter-Steering Assist (Optional)

Art of Rally has a configurable counter-steering assist. This automatically turns the front wheels into the skid:

```
# Detect oversteer: car is rotating faster than the steering would suggest
oversteering = sign(angularVelocity) != sign(steerAngle) and abs(angularVelocity) > threshold

if counterSteerAssist > 0 and oversteering:
    # Blend toward counter-steer direction
    counterAngle = atan2(localVel.y, abs(localVel.x))
    steerAngle = lerp(steerAngle, -counterAngle, counterSteerAssist * dt)
```

This makes the car more forgiving without removing skill. Set `counterSteerAssist` to 0 for expert mode, up to ~3.0 for beginner.

---

## 9. Visual Feedback (Critical for Top-Down Feel)

In a top-down view, the player can't feel G-forces or hear tyre squeal spatially. Visual cues are essential:

### Tyre Marks / Skid Trails
When lateral slip exceeds a threshold, draw marks behind the rear wheels:
```
slipAmount = abs(localVel.y) / max(abs(localVel.x), 1.0)
if slipAmount > 0.3:
    drawSkidMark(rearWheelPositions, opacity = clamp(slipAmount, 0, 1))
```

### Dust / Particle Trails
On dirt/gravel, emit particles proportional to speed and slip:
```
dustIntensity = speed * surfaceDustFactor * (1 + slipAmount * 2)
emitDustParticles(rearWheelPositions, dustIntensity)
```

### Car Body Roll (Visual Only)
Tilt the car sprite/model slightly based on lateral force:
```
visualRoll = lateralAcceleration * rollFactor   # small angle, e.g. max ±3°
renderCar(position, heading, visualRoll)
```

### Wheel Angle Visualization
Show front wheels turned — even in a top-down view, seeing the wheels angled communicates intent vs. momentum:
```
renderFrontWheels(heading + steerAngle)
renderRearWheels(heading)
```

---

## 10. Camera Behaviour

Art of Rally's camera is critical to the feel:

- **Camera follows behind the car** with a slight delay (lerp toward car position).
- **Camera rotates to match car heading** — so "up" on the screen is always roughly forward.
- **Look-ahead**: Offset the camera target slightly in the velocity direction so the player can see what's coming.
- **Speed zoom**: Subtle zoom-out at high speeds to widen the field of view.

```
targetPos = car.position + normalize(car.velocity) * lookAheadDistance
cameraPos = lerp(cameraPos, targetPos, cameraLerpSpeed * dt)
cameraAngle = lerpAngle(cameraAngle, car.heading, cameraRotationSpeed * dt)
zoomLevel = baseZoom + speed * zoomPerSpeed
```

---

## 11. Advanced Rally Techniques That Should Emerge Naturally

If the physics are implemented correctly, these techniques work **without special-case code**:

### Scandinavian Flick
Player steers opposite to corner → weight shifts → quickly steers into corner. The weight transfer and angular momentum from the initial flick cause the rear to break loose.

### Left-Foot Braking
Applying brakes while still on throttle shifts weight forward, loading front tyres for sharper turn-in while maintaining rear engine drive.

### Trail Braking
Braking into a corner and gradually releasing — the weight on the front axle gives extra steering grip through the corner entry.

### Handbrake Turns (Hairpins)
Handbrake kills rear grip → car pivots around front axle → release handbrake and power out.

### Power Oversteer (RWD)
Full throttle in a corner exceeds rear tyre grip → rear slides out → hold with counter-steer and throttle modulation.

### Lift-Off Oversteer
Releasing throttle mid-corner transfers weight forward → rear unloads → tail steps out. Works especially well in FWD and AWD cars.

If any of these don't work, debug by checking:
- Are slip angles being calculated correctly with yaw rate contribution?
- Is weight transfer affecting per-axle grip?
- Is the handbrake actually reducing rear lateral force?

---

## 12. Recommended Tuning Values (Starting Point)

```
mass              = 1200 kg
inertia           = 1200 kg·m²
cgToFront         = 1.2 m
cgToRear          = 1.2 m
cgHeight          = 0.5 m    (for weight transfer calc)
maxSteerAngle     = 0.5 rad  (≈ 29°)
cornerStiffF      = 5.0
cornerStiffR      = 5.2
maxGrip           = 2.5
engineForce       = 8000 N
brakeForce        = 12000 N
dragCoeff         = 2.5
rollResistCoeff   = 30
handbrakeGripMul  = 0.2
```

### Per-Car-Class Variation

| Class | Mass | Engine | Cornering F/R | Notes |
|-------|------|--------|---------------|-------|
| Group 2 (60s) | 1000 | 5000 | 4.0 / 4.5 | Low power, predictable |
| Group 4 (70s) | 1100 | 7000 | 4.5 / 5.0 | More power, still manageable |
| Group B (80s) | 1200 | 12000 | 5.5 / 5.0 | Extreme power, tail-happy |
| Group A (90s) | 1300 | 9000 | 5.5 / 5.5 | Balanced AWD monsters |

---

## 13. Common Pitfalls

1. **Car spins endlessly**: Your cornering force drops off past peak (Pacejka curve). Solution: **clamp** lateral force, don't reduce it.

2. **Car feels like it's on rails**: Cornering stiffness is too high or maxGrip is too high. Reduce both; the car should noticeably slide on gravel.

3. **Drifts are impossible to hold**: Either the handbrake grip multiplier is too low (car snaps) or counter-steering assist is fighting the player. Check both.

4. **Car jitters at low speed**: Slip angle calculations divide by near-zero forward speed. Add the low-speed stability patch from Step 7.

5. **No difference between surfaces**: Make sure surface grip multiplier is applied to BOTH lateral forces AND traction limits. A 0.6 grip surface should feel dramatically different from 1.0.

6. **All cars feel the same**: Vary mass, engine force, cornering stiffness front/rear ratio, and drivetrain type. The F/R stiffness ratio is the biggest differentiator for handling character.

7. **Steering feels too twitchy at speed**: Implement speed-sensitive steering reduction. Also ensure steering input is smoothed, not instant.

8. **Handbrake doesn't initiate rotation**: The handbrake must reduce LATERAL grip on the rear, not just add longitudinal braking. Reducing rear lateral grip is what allows the front to out-grip the rear and create yaw.

---

## 14. Pseudocode: Complete Physics Step

```python
def physics_step(car, input, dt):
    # -- Transform to local space --
    speed = length(car.velocity)
    local_vx =  cos(car.heading) * car.velocity.x + sin(car.heading) * car.velocity.y
    local_vy = -sin(car.heading) * car.velocity.x + cos(car.heading) * car.velocity.y

    # -- Steering --
    speed_factor = 1.0 - clamp(speed / MAX_SPEED, 0, 1) * 0.7
    target_steer = input.steer * MAX_STEER_ANGLE * speed_factor
    car.steer_angle = move_toward(car.steer_angle, target_steer, STEER_RATE * dt)

    # -- Slip Angles --
    abs_vx = max(abs(local_vx), 0.5)  # avoid division by zero
    front_slip = atan2(local_vy + car.angular_vel * car.cg_to_front, abs_vx) \
                 - sign(local_vx) * car.steer_angle
    rear_slip  = atan2(local_vy - car.angular_vel * car.cg_to_rear,  abs_vx)

    # -- Weight Transfer --
    weight_f = car.mass * 0.5
    weight_r = car.mass * 0.5
    if ENABLE_WEIGHT_TRANSFER:
        transfer = car.last_accel_x * car.mass * CG_HEIGHT / car.wheelbase
        weight_f += transfer
        weight_r -= transfer

    # -- Lateral Forces --
    surface_grip = get_surface_grip(car.position)
    front_lat = clamp(-CORNER_STIFF_F * front_slip, -MAX_GRIP, MAX_GRIP)
    rear_lat  = clamp(-CORNER_STIFF_R * rear_slip,  -MAX_GRIP, MAX_GRIP)

    front_lat *= (weight_f / (car.mass * 0.5)) * surface_grip
    rear_lat  *= (weight_r / (car.mass * 0.5)) * surface_grip

    # -- Handbrake --
    if input.handbrake:
        rear_lat *= HANDBRAKE_GRIP_MUL

    # -- Longitudinal Forces --
    if input.throttle > 0:
        traction = input.throttle * ENGINE_FORCE
    else:
        traction = input.throttle * BRAKE_FORCE

    # Limit traction by surface grip
    max_traction = car.mass * GRAVITY * surface_grip * FRICTION_COEFF
    traction = clamp(traction, -max_traction, max_traction)

    drag = -DRAG_COEFF * local_vx * abs(local_vx)
    rolling = -ROLL_RESIST * local_vx
    total_long = traction + drag + rolling

    # -- Compose Forces (local space) --
    force_x = total_long
    force_y = cos(car.steer_angle) * front_lat + rear_lat

    torque = car.cg_to_front * cos(car.steer_angle) * front_lat \
           - car.cg_to_rear * rear_lat

    # -- Transform to world space and integrate --
    world_fx = cos(car.heading) * force_x - sin(car.heading) * force_y
    world_fy = sin(car.heading) * force_x + cos(car.heading) * force_y

    accel = vec2(world_fx, world_fy) / car.mass
    car.velocity += accel * dt
    car.position += car.velocity * dt

    ang_accel = torque / car.inertia
    car.angular_vel += ang_accel * dt
    car.heading += car.angular_vel * dt

    # -- Store for weight transfer next frame --
    car.last_accel_x = total_long / car.mass

    # -- Low speed stability --
    if speed < 0.5:
        car.angular_vel *= 0.9
    if speed < 0.1 and abs(input.throttle) < 0.01:
        car.velocity = vec2(0, 0)
        car.angular_vel = 0
```

---

## 15. Implementation Checklist

- [ ] Car state: position, velocity, heading, angular velocity
- [ ] World-to-local velocity transform
- [ ] Slip angle calculation with yaw rate contribution
- [ ] Clamped linear lateral force model (NOT Pacejka drop-off)
- [ ] Longitudinal forces: throttle, brake, drag, rolling resistance
- [ ] Force composition and Euler integration
- [ ] Speed-sensitive steering with smoothing
- [ ] Handbrake reducing rear lateral grip
- [ ] Surface grip multipliers (tarmac, gravel, dirt, snow, etc.)
- [ ] Weight transfer between axles
- [ ] Low-speed stability damping
- [ ] Drivetrain types (FWD/RWD/AWD)
- [ ] Visual feedback: skid marks, dust, body roll
- [ ] Camera: follow with lerp, heading rotation, look-ahead, speed zoom
- [ ] Counter-steer assist (optional, configurable)
- [ ] Per-car tuning: mass, power, cornering stiffness, drivetrain

---

## 16. Key References

- **Marco Monster's "Car Physics for Games"** — the foundational paper for simplified car physics in games. Covers the bicycle model, slip angles, and lateral forces. Archived at: `asawicki.info/Mirror/Car Physics for Games/`
- **spacejack/carphysics2d** (GitHub) — clean JavaScript implementation of Marco Monster's model.
- **Siorki's js13k implementation** — adds angular velocity contribution to wheel velocity and variable axle distances.
- **Brian Beckman's "The Physics of Racing"** — deeper theory on tyre behaviour, weight transfer, and the friction circle.
- **"Implementing Racing Games"** (superheroesinracecars.com) — excellent overview of different approaches to game vehicle physics with design trade-offs.

---

## 17. Summary: The Art of Rally Recipe

1. **Bicycle model** with front/rear axle slip angles.
2. **Linear cornering force clamped at maximum** — never decreasing. This is the single most important design decision.
3. **Weight transfer** for natural understeer/oversteer transitions.
4. **Handbrake = rear grip reduction**, not braking.
5. **Surface grip multipliers** for terrain variety.
6. **Speed-dependent steering** for stability at speed.
7. **Per-car tuning** via mass, power, stiffness ratios, and drivetrain.
8. **Rich visual feedback** to compensate for the lack of force-feedback in top-down view.
9. **Camera that follows and rotates** with the car, providing look-ahead.
10. **No magic drift button** — all sliding emerges from the physics.

Build this and you'll have a driving model where skilled players can Scandinavian flick through hairpins, hold power slides through sweeping gravel corners, and feel the satisfying transition from grip to slip — all from a bird's eye view.