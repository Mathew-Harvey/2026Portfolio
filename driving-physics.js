/**
 * driving-physics.js — Enhanced Pure ES module for Art of Rally–style driving physics.
 *
 * ENHANCED ARCADE DRIFT TUNING:
 *   - Drift initiation: Weight transfer spike, transient slip boost, momentum yaw kick
 *   - Drift sustain: Throttle-angle coupling, momentum preservation, progressive counter-steer
 *   - Steering feel: Variable rate based on car state, reduced SAT during drift
 *   - Handbrake: Entry boost, smooth release transition
 *   - Recovery: Spin recovery assist, over-rotation damping
 *
 * Bicycle-model with:
 *   - Smooth Pacejka-like tire curves (not linear clamp)
 *   - Friction circle (traction vs lateral grip budget)
 *   - Tire load sensitivity
 *   - Engine braking & lift-off oversteer
 *   - Self-aligning torque (reduced during drift)
 *   - Weight transfer with transient spike
 *   - Throttle/brake smoothing
 *   - Semi-implicit Euler integration
 *   - Surface grip, handbrake, drift scoring
 *
 * All functions are PURE — they take inputs and return outputs with no
 * DOM / Three.js / scene side-effects.
 */

// ============================================================
// CONSTANTS
// ============================================================

export const DRIVE_SURFACE_GRIP = {
    tarmac: 1.0,
    gravel: 0.62,
    dirt:   0.55,
    snow:   0.28,
    grass:  0.40
};

export const DRIVE_CAR_TUNES = {
    default: {
        mass: 1200,
        inertia: 1800,

        cgToFront: 1.15,
        cgToRear:  1.25,
        cgHeight:  0.35,

        maxSteerAngle: 0.38,  // Increased for more dramatic steering

        cornerStiffF: 8.0,
        cornerStiffR: 7.8,      // Slightly softer rear for easier drift initiation
        peakGripF: 1.14,
        peakGripR: 1.28,        // Slightly reduced rear grip for easier slide
        falloffF: 0.85,
        falloffR: 0.68,         // More falloff for sustained drifts

        loadSensitivity: 0.18,  // More responsive to weight transfer

        engineForce: 36000,     // Slightly more power for better throttle control
        reverseForce: 15000,
        launchDriveMul: 1.50,   // More launch punch
        brakeForce: 20000,
        engineBrakeForce: 3400, // More engine braking for lift-off oversteer
        throttleResponse: 26.0, // Snappier throttle
        brakeResponse: 20.0,    // Snappier brakes

        dragCoeff: 1.15,        // Slightly less drag
        rollResistCoeff: 36,

        handbrakeGripMul: 0.12, // More dramatic handbrake slides
        handbrakeBrakeForce: 4500,
        handbrakeEngineBrakeMul: 0.55,

        tractionGrip: 2.85,

        drivetrain: "rwd",
        awdFrontBias: 0.4,

        maxForwardSpeed: 64,
        maxReverseSpeed: 19,

        boostMultiplier: 1.75,

        yawDamping: 1350,        // Reduced for more rotational freedom

        frictionCircle: 0.26,

        selfAligningTorque: 0.07,  // Reduced for less fight during drifts
        torqueReactionYaw: 0.0015, // More power-on rotation

        // NEW: Drift-specific tuning
        driftInitiationBoost: 0.35,    // Extra yaw impulse when initiating drift
        driftSustainThrottle: 0.25,    // Throttle influence on drift angle maintenance
        liftOffOversteerMul: 1.4,      // Multiplier for lift-off weight transfer
        handbrakeEntryBoost: 0.45,     // Extra rotation on handbrake pull
        spinRecoveryStrength: 0.6      // How much spin recovery assist kicks in
    },

    mazda: {
        drivetrain: "rwd", mass: 1180, inertia: 1650,
        engineForce: 36500,
        reverseForce: 15500,
        launchDriveMul: 1.40,
        cornerStiffF: 7.5, cornerStiffR: 6.8,
        peakGripF: 1.02, peakGripR: 1.05,
        falloffR: 0.50,
        engineBrakeForce: 3200,
        torqueReactionYaw: 0.0048,
        driftInitiationBoost: 0.40,
        driftSustainThrottle: 0.30,
        yawDamping: 1200
    },
    sport: {
        drivetrain: "awd", mass: 1260, inertia: 1900,
        engineForce: 38000,
        reverseForce: 17500,
        launchDriveMul: 1.35,
        cornerStiffF: 8.0, cornerStiffR: 7.2,
        peakGripF: 1.03, peakGripR: 1.08,
        awdFrontBias: 0.40,
        maxForwardSpeed: 68,
        tractionGrip: 2.65,
        falloffR: 0.62,
        engineBrakeForce: 2900,
        torqueReactionYaw: 0.0035,
        driftInitiationBoost: 0.28,
        driftSustainThrottle: 0.22
    }
};

export const DRIVE_PHYSICS = {
    gravity: 9.81,
    minSlipSpeed: 0.5,

    // STEERING - Variable rate system
    steerRate: 4.2,              // Faster base steering
    steerRateDrift: 2.8,         // Slower steering when in drift (more control)
    steerCenterRate: 5.5,        // Faster return to center
    steerRateSpeedScale: 0.35,   // How much speed affects steering rate

    // COUNTER-STEER ASSIST - More progressive
    counterSteerAssist: 3.0,     // Slightly reduced base assist
    counterSteerOversteerRatio: 1.02,
    counterSteerMinSlip: 0.025,  // Lower threshold for earlier assist
    counterSteerMinSpeed: 0.6,
    counterSteerBlend: 0.72,     // Slightly less aggressive blend
    counterSteerYawBrake: 1.05,
    counterSteerProgressive: 0.4, // NEW: Progressive scaling with drift angle

    // LOW SPEED
    lowSpeedThreshold: 2.8,
    lowSpeedAngDamping: 0.90,    // Less damping at low speed for tighter turns

    stopSpeed: 0.08,

    // LATERAL DYNAMICS
    lateralDragFactor: 0.997,    // Even less lateral damping for sustained slides
    wheelspinLateralDragRelief: 0.05,
    wheelspinYawDampingRelief: 0.025,

    // DRIFT INITIATION
    steerRateYawKick: 0.15,      // NEW: Yaw impulse from rapid steering
    weightTransferSpike: 0.35,   // NEW: Transient weight transfer boost
    weightTransferSpikeDecay: 8.0, // NEW: How fast spike decays
    momentumYawKick: 0.12,       // NEW: Yaw kick from steering into existing slide

    // DRIFT SUSTAIN
    driftMomentumPreserve: 0.015, // NEW: Extra momentum preservation in drift
    throttleAngleCoupling: 0.18,  // NEW: How throttle affects drift angle
    driftSATReduction: 0.7,       // NEW: SAT reduction during drift (0-1)

    // SPIN RECOVERY
    spinRecoveryThreshold: 0.45,  // NEW: Slip angle where spin recovery kicks in
    spinRecoveryDamping: 2.5,     // NEW: Extra damping when spinning

    // DRIFT DETECTION
    driftSlipThreshold: 0.11,
    driftSlipThresholdTarmac: 0.13,
    driftSlipThresholdHandbrake: 0.08,
    driftMinSpeed: 4.2,           // Slightly lower for earlier detection
    driftAwardMin: 120,           // Lower threshold for more frequent rewards
    driftStreakWindow: 2.6,       // Slightly longer window for combos

    // HANDBRAKE
    handbrakeYawBoost: 0.35,      // NEW: Extra rotation on handbrake pull
    handbrakeReleaseBlend: 4.5    // NEW: Smooth transition on release
};

// ============================================================
// HELPERS
// ============================================================

export function getDriveTune(activeCar) {
    const base = DRIVE_CAR_TUNES.default;
    const spec = DRIVE_CAR_TUNES[activeCar] || {};
    return { ...base, ...spec };
}

export function getSurfaceType(roadDistVal, terrainH) {
    if (roadDistVal <= 0) return "tarmac";
    if (terrainH > 3.8) return "snow";
    if (roadDistVal < 3.5) return "gravel";
    if (roadDistVal < 10) return "dirt";
    return "grass";
}

export function getSurfaceGrip(surfaceType) {
    return DRIVE_SURFACE_GRIP[surfaceType] ?? 1.0;
}

export function getSurfaceRollingMul(surfaceType) {
    if (surfaceType === "tarmac") return 1.0;
    if (surfaceType === "gravel") return 1.2;
    if (surfaceType === "dirt") return 1.35;
    if (surfaceType === "snow") return 1.6;
    return 1.45;
}

// ============================================================
// MATH HELPERS
// ============================================================

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function sign(v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}
// NEW: Exponential decay helper
function expDecay(current, target, rate, dt) {
    return target + (current - target) * Math.exp(-rate * dt);
}

// ============================================================
// PACEJKA-LIKE TIRE CURVE
// ============================================================

function tireForce(slipAngle, B, D, falloff) {
    const C = 1.9;
    const rawNorm = Math.sin(C * Math.atan(B * slipAngle));

    const absNorm = Math.abs(rawNorm);
    const absSlip = Math.abs(slipAngle);

    if (absSlip > 0.18 && absNorm < falloff) {
        const floorForce = sign(slipAngle) * D * falloff;
        const blendAmount = smoothstep(0.18, 0.55, absSlip);
        return lerp(rawNorm * D, floorForce, blendAmount);
    }

    return rawNorm * D;
}

// ============================================================
// MAIN PHYSICS STEP
// ============================================================

export function stepPhysics(dt, inputs, vehicle, tune, surfaceGrip, surfaceType) {
    const { throttle: rawThrottle, steer: steerInput, handbrake, boost } = inputs;
    const boostMul = boost ? tune.boostMultiplier : 1;
    const G = DRIVE_PHYSICS.gravity;

    // ---- Smoothed inputs with history ----
    const prevSmThrottle = vehicle.smoothThrottle || 0;
    const prevSmReverse = vehicle.smoothReverse || 0;
    const prevSmBrake = vehicle.smoothBrake || 0;
    const prevSteer = vehicle.steer || 0;
    const prevHandbrake = vehicle.wasHandbrake || false;

    const thAlpha = 1 - Math.exp(-tune.throttleResponse * dt);
    const brAlpha = 1 - Math.exp(-tune.brakeResponse * dt);

    // ---- Heading and basis vectors ----
    const heading = vehicle.heading;
    const sinH = Math.sin(heading), cosH = Math.cos(heading);
    const fwdX = -sinH, fwdZ = -cosH, rightX = cosH, rightZ = -sinH;

    let velX = vehicle.velX || 0;
    let velZ = vehicle.velZ || 0;
    let angularVel = vehicle.angularVel || 0;

    let localVx = velX * fwdX + velZ * fwdZ;
    let localVy = velX * rightX + velZ * rightZ;
    const speed = Math.hypot(velX, velZ);
    const absVx = Math.max(Math.abs(localVx), DRIVE_PHYSICS.minSlipSpeed);
    const driveSign = (localVx >= 0) ? 1 : -1;

    // ---- Detect current drift state for steering adjustments ----
    const currentSlipRatio = Math.abs(localVy) / Math.max(Math.abs(localVx), 1);
    const isInDrift = currentSlipRatio > DRIVE_PHYSICS.driftSlipThreshold && speed > DRIVE_PHYSICS.driftMinSpeed;

    // ---- Input processing ----
    const wantsForward = rawThrottle > 0;
    const wantsReverse = rawThrottle < 0;
    const nearStop = Math.abs(localVx) < 1.0;
    const movingBackward = localVx < -0.5;
    const reverseAllowed = wantsReverse && (nearStop || movingBackward);

    const targetThrottle = wantsForward ? rawThrottle : 0;
    const targetReverse = reverseAllowed ? -rawThrottle : 0;
    const targetBrake = wantsReverse && !reverseAllowed ? -rawThrottle : 0;

    const smoothThrottle = lerp(prevSmThrottle, targetThrottle, thAlpha);
    const smoothReverse = lerp(prevSmReverse, targetReverse, thAlpha);
    const smoothBrake = lerp(prevSmBrake, targetBrake, brAlpha);

    // ---- Throttle lift detection for lift-off oversteer ----
    const throttleDelta = smoothThrottle - prevSmThrottle;
    const isThrottleLift = throttleDelta < -0.02 && speed > 8;

    // ---- ENHANCED STEERING with variable rate ----
    const speedNorm = Math.min(speed / (tune.maxForwardSpeed * boostMul), 1);
    const speedFactor = 1 - speedNorm * speedNorm * 0.42;
    const effectiveMaxSteer = tune.maxSteerAngle * speedFactor;
    const targetSteer = steerInput * effectiveMaxSteer;

    // Variable steering rate: faster turn-in, slower in drift
    let steerRate = DRIVE_PHYSICS.steerRate;
    if (isInDrift) {
        steerRate = lerp(steerRate, DRIVE_PHYSICS.steerRateDrift, currentSlipRatio * 2);
    }
    // Speed-based steering rate scaling
    steerRate *= (1 - speedNorm * DRIVE_PHYSICS.steerRateSpeedScale);

    let curSteer = prevSteer;
    const steerStep = steerRate * dt;
    const steerDelta = targetSteer - curSteer;

    if (Math.abs(steerDelta) <= steerStep) {
        curSteer = targetSteer;
    } else {
        curSteer += Math.sign(steerDelta) * steerStep;
    }

    if (Math.abs(steerInput) < 0.01) {
        curSteer -= curSteer * DRIVE_PHYSICS.steerCenterRate * dt;
    }
    curSteer = clamp(curSteer, -effectiveMaxSteer, effectiveMaxSteer);

    // ---- Calculate steering rate for yaw kick ----
    const steerRateActual = Math.abs(curSteer - prevSteer) / dt;

    // ---- Slip angles ----
    const frontSlip = Math.atan2(
        localVy + angularVel * tune.cgToFront, absVx
    ) - driveSign * curSteer;

    const rearSlip = Math.atan2(
        localVy - angularVel * tune.cgToRear, absVx
    );

    // ---- ENHANCED Counter-steer assist with progressive scaling ----
    let oversteerCatch = 0;
    if (DRIVE_PHYSICS.counterSteerAssist > 0
        && Math.abs(localVx) > DRIVE_PHYSICS.counterSteerMinSpeed) {
        const absR = Math.abs(rearSlip);
        const absF = Math.abs(frontSlip);
        const isOversteer = absR > absF * DRIVE_PHYSICS.counterSteerOversteerRatio
                         && absR > DRIVE_PHYSICS.counterSteerMinSlip;
        if (isOversteer) {
            const counterAngle = Math.atan2(localVy, absVx);

            // Progressive assist: less when slip is low, more when high
            const slipIntensity = clamp((absR - DRIVE_PHYSICS.counterSteerMinSlip) / 0.3, 0, 1);
            const progressiveBlend = DRIVE_PHYSICS.counterSteerBlend *
                (1 - DRIVE_PHYSICS.counterSteerProgressive + DRIVE_PHYSICS.counterSteerProgressive * slipIntensity);

            const assistAmt = Math.min(1, DRIVE_PHYSICS.counterSteerAssist * dt);
            curSteer = lerp(curSteer, -counterAngle, assistAmt * progressiveBlend);

            oversteerCatch = clamp(slipIntensity, 0, 1);
        }
    }

    // ---- ENHANCED Weight transfer with transient spike ----
    const wheelBase = tune.cgToFront + tune.cgToRear;
    const baseFront = tune.mass * (tune.cgToRear / wheelBase);
    const baseRear = tune.mass * (tune.cgToFront / wheelBase);

    // Base weight transfer
    let wt = (vehicle.lastLongAccel * tune.mass * tune.cgHeight) / (wheelBase * G);

    // Transient weight transfer spike on throttle lift (lift-off oversteer enhancement)
    let wtSpike = vehicle.weightTransferSpike || 0;
    if (isThrottleLift) {
        const liftMagnitude = Math.abs(throttleDelta) * (tune.liftOffOversteerMul || 1.4);
        wtSpike = Math.max(wtSpike, liftMagnitude * DRIVE_PHYSICS.weightTransferSpike * tune.mass);
    }
    // Decay the spike
    wtSpike = expDecay(wtSpike, 0, DRIVE_PHYSICS.weightTransferSpikeDecay, dt);
    wt += wtSpike / tune.mass;

    const weightFront = clamp(baseFront + wt, tune.mass * 0.08, tune.mass * 0.92);
    const weightRear = clamp(baseRear - wt, tune.mass * 0.08, tune.mass * 0.92);

    // Load sensitivity
    const ls = tune.loadSensitivity || 0;
    const fLoadScale = 1 - ls * (weightFront / baseFront - 1);
    const rLoadScale = 1 - ls * (weightRear / baseRear - 1);

    const frontPeakF = tune.peakGripF * fLoadScale * weightFront * G * surfaceGrip;
    const rearPeakF = tune.peakGripR * rLoadScale * weightRear * G * surfaceGrip;

    // ---- Traction forces ----
    const launchMulBase = tune.launchDriveMul || 1.0;
    const launchFade = smoothstep(2, 16, Math.abs(localVx));
    const launchMul = lerp(launchMulBase, 1.0, launchFade);
    const forwardDriveForce = smoothThrottle * tune.engineForce * boostMul * launchMul;
    const reverseDriveForce = -smoothReverse * (tune.reverseForce || (tune.engineForce * 0.55)) * launchMul;
    const driveForce = forwardDriveForce + reverseDriveForce;
    const brakeForce = smoothBrake * tune.brakeForce;

    // Engine braking (enhanced for lift-off oversteer)
    let engineBrakeF = 0;
    if (smoothThrottle < 0.1 && smoothReverse < 0.1 && Math.abs(localVx) > 1.0) {
        const ebScale = 1 - Math.max(smoothThrottle, smoothReverse) / 0.1;
        const spScale = Math.min(Math.abs(localVx) / 15, 1);
        engineBrakeF = tune.engineBrakeForce * ebScale * spScale;
        // Extra engine brake effect when lifting off at speed
        if (isThrottleLift) {
            engineBrakeF *= 1.25;
        }
    }

    let frontTrac = 0, rearTrac = 0;

    if (Math.abs(driveForce) > 0) {
        if (tune.drivetrain === "fwd") frontTrac = driveForce;
        else if (tune.drivetrain === "awd") {
            frontTrac = driveForce * tune.awdFrontBias;
            rearTrac = driveForce * (1 - tune.awdFrontBias);
        } else rearTrac = driveForce;
    }

    if (brakeForce > 0) {
        const bs = -sign(localVx) || -1;
        frontTrac += bs * brakeForce * 0.6;
        rearTrac += bs * brakeForce * 0.4;
    }

    if (engineBrakeF > 0) {
        const es = -sign(localVx) || -1;
        if (tune.drivetrain === "fwd") frontTrac += es * engineBrakeF;
        else if (tune.drivetrain === "awd") {
            frontTrac += es * engineBrakeF * tune.awdFrontBias;
            rearTrac += es * engineBrakeF * (1 - tune.awdFrontBias);
        } else rearTrac += es * engineBrakeF;
    }

    // ---- ENHANCED Handbrake with entry boost ----
    let handbrakeYawImpulse = 0;
    if (handbrake && Math.abs(localVx) > 0.2) {
        rearTrac += -sign(localVx) * tune.handbrakeBrakeForce;
        if (tune.drivetrain !== "fwd") {
            rearTrac += -sign(localVx) * tune.engineBrakeForce * (tune.handbrakeEngineBrakeMul || 0.5);
        }

        // NEW: Handbrake entry boost - extra yaw impulse when first pulling handbrake
        if (!prevHandbrake && speed > 5) {
            const hbBoost = (tune.handbrakeEntryBoost || DRIVE_PHYSICS.handbrakeYawBoost);
            handbrakeYawImpulse = sign(curSteer || localVy) * hbBoost * tune.inertia *
                Math.min(speed / 20, 1);
        }
    }

    // Traction limits
    const maxFTrac = weightFront * G * surfaceGrip * tune.tractionGrip;
    const maxRTrac = weightRear * G * surfaceGrip * tune.tractionGrip;
    const frontDemand = Math.abs(frontTrac);
    const rearDemand = Math.abs(rearTrac);
    frontTrac = clamp(frontTrac, -maxFTrac, maxFTrac);
    rearTrac = clamp(rearTrac, -maxRTrac, maxRTrac);

    // Wheelspin calculation
    const fSpinExcess = maxFTrac > 0 ? Math.max(0, frontDemand / maxFTrac - 1) : 0;
    const rSpinExcess = maxRTrac > 0 ? Math.max(0, rearDemand / maxRTrac - 1) : 0;
    let drivenSpinExcess;
    if (tune.drivetrain === "fwd") drivenSpinExcess = fSpinExcess;
    else if (tune.drivetrain === "awd") {
        drivenSpinExcess = fSpinExcess * tune.awdFrontBias + rSpinExcess * (1 - tune.awdFrontBias);
    } else drivenSpinExcess = rSpinExcess;
    const wheelspin01 = clamp(drivenSpinExcess / (1 + drivenSpinExcess), 0, 1);

    // Friction circle
    const fc = tune.frictionCircle || 0;
    let fLatPeak = frontPeakF;
    let rLatPeak = rearPeakF;

    if (fc > 0) {
        const fTR = maxFTrac > 0 ? clamp(Math.abs(frontTrac) / maxFTrac, 0, 1) : 0;
        const rTR = maxRTrac > 0 ? clamp(Math.abs(rearTrac) / maxRTrac, 0, 1) : 0;
        const fLS = Math.sqrt(Math.max(0, 1 - fTR * fTR));
        const rLS = Math.sqrt(Math.max(0, 1 - rTR * rTR));
        fLatPeak *= lerp(1, fLS, fc);
        rLatPeak *= lerp(1, rLS, fc);
    }

    // Lateral forces
    let frontLat = -tireForce(frontSlip, tune.cornerStiffF, fLatPeak, tune.falloffF);
    let rearLat = -tireForce(rearSlip, tune.cornerStiffR, rLatPeak, tune.falloffR);

    if (handbrake) {
        rearLat *= tune.handbrakeGripMul;
    }

    // ---- Total forces ----
    const totalTrac = frontTrac + rearTrac;
    const dragF = -tune.dragCoeff * localVx * Math.abs(localVx);
    const rollR = -tune.rollResistCoeff * getSurfaceRollingMul(surfaceType) * localVx;
    const totalLong = totalTrac + dragF + rollR;

    const cosS = Math.cos(curSteer);
    const forceX = totalLong;
    const forceY = cosS * frontLat + rearLat;

    // ---- ENHANCED Yaw torque calculation ----
    let rawYaw = tune.cgToFront * cosS * frontLat - tune.cgToRear * rearLat;

    // Throttle-on rotation helper
    if (Math.abs(curSteer) > 0.02 && smoothThrottle > 0.05 && Math.abs(localVx) > 2) {
        const yawSpeedFactor = smoothstep(1.5, 16, Math.abs(localVx));
        const yawBoost = (tune.torqueReactionYaw || 0) * tune.engineForce * smoothThrottle * yawSpeedFactor;
        rawYaw += sign(curSteer) * yawBoost;
    }

    // NEW: Drift initiation yaw kick from rapid steering
    if (steerRateActual > 0.5 && speed > 6) {
        const driftInit = (tune.driftInitiationBoost || DRIVE_PHYSICS.steerRateYawKick);
        const kickStrength = Math.min(steerRateActual / 3, 1) * driftInit;
        rawYaw += sign(steerDelta) * kickStrength * tune.inertia * surfaceGrip;
    }

    // NEW: Momentum yaw kick - steering into existing lateral velocity
    if (Math.abs(localVy) > 1 && Math.abs(curSteer) > 0.05) {
        const steeringIntoSlide = sign(localVy) === sign(curSteer);
        if (steeringIntoSlide) {
            const momentumKick = DRIVE_PHYSICS.momentumYawKick * Math.abs(localVy) * Math.abs(curSteer);
            rawYaw += sign(curSteer) * momentumKick * tune.inertia;
        }
    }

    // NEW: Throttle-angle coupling for drift sustain
    if (isInDrift && smoothThrottle > 0.3 && tune.drivetrain !== "fwd") {
        const driftSustain = (tune.driftSustainThrottle || DRIVE_PHYSICS.throttleAngleCoupling);
        const sustainTorque = sign(rearSlip) * smoothThrottle * driftSustain * tune.inertia;
        rawYaw += sustainTorque * currentSlipRatio;
    }

    // Add handbrake entry yaw impulse
    rawYaw += handbrakeYawImpulse;

    // ---- Self-aligning torque (reduced during drift) ----
    const sat = tune.selfAligningTorque || 0;
    let satTorque = 0;
    if (sat > 0 && speed > 1) {
        const satMag = Math.abs(frontLat) * (1 - smoothstep(0.15, 0.6, Math.abs(frontSlip)));
        satTorque = -sign(frontSlip) * satMag * sat;

        // NEW: Reduce SAT during drift for easier maintenance
        if (isInDrift) {
            satTorque *= (1 - DRIVE_PHYSICS.driftSATReduction * currentSlipRatio);
        }
    }

    // ---- ENHANCED Yaw damping with spin recovery ----
    const spDamp = 0.3 + Math.min(Math.abs(localVx) / 20, 1) * 0.7;

    // Handbrake damping reduction with smooth release
    let hbDamp = 1.0;
    if (handbrake) {
        hbDamp = 0.32;
    } else if (prevHandbrake) {
        // Smooth transition when releasing handbrake
        hbDamp = lerp(0.32, 1.0, DRIVE_PHYSICS.handbrakeReleaseBlend * dt);
    }

    const spinYawRelief = 1 - wheelspin01 * (DRIVE_PHYSICS.wheelspinYawDampingRelief || 0);
    const catchDamp = 1 + oversteerCatch * (DRIVE_PHYSICS.counterSteerYawBrake || 0);

    // NEW: Spin recovery - extra damping when car is spinning out
    let spinRecoveryDamp = 1.0;
    const absRearSlip = Math.abs(rearSlip);
    if (absRearSlip > DRIVE_PHYSICS.spinRecoveryThreshold) {
        const spinIntensity = (absRearSlip - DRIVE_PHYSICS.spinRecoveryThreshold) / 0.4;
        const recoveryStrength = tune.spinRecoveryStrength || 0.6;
        spinRecoveryDamp = 1 + spinIntensity * DRIVE_PHYSICS.spinRecoveryDamping * recoveryStrength;
    }

    const yawDamp = (tune.yawDamping || 0) * hbDamp * spDamp * spinYawRelief * catchDamp * spinRecoveryDamp;
    const yawTorque = rawYaw + satTorque - angularVel * yawDamp;

    // ---- Integration ----
    const wFx = fwdX * forceX + rightX * forceY;
    const wFz = fwdZ * forceX + rightZ * forceY;

    velX += (wFx / tune.mass) * dt;
    velZ += (wFz / tune.mass) * dt;
    angularVel += (yawTorque / tune.inertia) * dt;

    // Low speed angular damping
    const lsBlend = 1 - smoothstep(0, DRIVE_PHYSICS.lowSpeedThreshold, speed);
    if (lsBlend > 0) {
        angularVel *= lerp(1, DRIVE_PHYSICS.lowSpeedAngDamping, lsBlend);
    }

    // Full stop
    if (speed < DRIVE_PHYSICS.stopSpeed && smoothThrottle < 0.01
        && smoothReverse < 0.01 && smoothBrake < 0.01 && !handbrake) {
        velX = 0; velZ = 0; angularVel = 0;
    }

    // ---- Speed limiting and lateral drag ----
    localVx = velX * fwdX + velZ * fwdZ;
    localVy = velX * rightX + velZ * rightZ;
    localVx = clamp(localVx, -tune.maxReverseSpeed, tune.maxForwardSpeed * boostMul);

    // Lateral drag with wheelspin relief and drift momentum preservation
    const latDragRelief = clamp(wheelspin01 * (DRIVE_PHYSICS.wheelspinLateralDragRelief || 0), 0, 1);
    let dynamicLateralDrag = lerp(DRIVE_PHYSICS.lateralDragFactor, 1.0, latDragRelief);

    // NEW: Extra momentum preservation during drift
    if (isInDrift) {
        dynamicLateralDrag = lerp(dynamicLateralDrag, 1.0, DRIVE_PHYSICS.driftMomentumPreserve);
    }

    localVy *= dynamicLateralDrag;
    velX = fwdX * localVx + rightX * localVy;
    velZ = fwdZ * localVx + rightZ * localVy;

    const newHeading = heading + angularVel * dt;

    return {
        velX, velZ, angularVel,
        heading: newHeading,
        steer: curSteer,
        lastLongAccel: totalLong / tune.mass,
        smoothThrottle, smoothReverse, smoothBrake,
        localVx, localVy,
        speed: Math.hypot(velX, velZ),
        forceY,
        frontSlip, rearSlip,
        fwdX, fwdZ, rightX, rightZ,
        surfaceType,
        // NEW: Additional state for next frame
        wasHandbrake: handbrake,
        weightTransferSpike: wtSpike,
        isInDrift
    };
}

// ============================================================
// DRIFT DETECTION
// ============================================================

export function isDrifting(localVx, localVy, speed, surfaceType, handbrake) {
    const slipAmount = Math.abs(localVy) / Math.max(Math.abs(localVx), 1);
    const threshold = handbrake
        ? DRIVE_PHYSICS.driftSlipThresholdHandbrake
        : (surfaceType === "tarmac"
            ? DRIVE_PHYSICS.driftSlipThresholdTarmac
            : DRIVE_PHYSICS.driftSlipThreshold);
    return {
        drifting: slipAmount > threshold && speed > DRIVE_PHYSICS.driftMinSpeed,
        slipAmount
    };
}

// ============================================================
// DRIFT SCORING (Enhanced with angle bonus)
// ============================================================

export function stepDriftScoring(dt, drifting, slipAmount, speed, surfaceGrip, handbrake, ds) {
    let awardResult = null;
    if (ds.streakTimer > 0) {
        ds.streakTimer -= dt;
        if (ds.streakTimer <= 0) ds.streak = 0;
    }
    if (drifting) {
        if (!ds.driftingNow) {
            ds.current = 0;
            ds.streak = (ds.streakTimer > 0) ? (ds.streak + 1) : 1;
            ds.streakTimer = DRIVE_PHYSICS.driftStreakWindow;
            ds.hadHandbrake = false;
            ds.maxAngle = 0;  // Track max angle for bonus
        }

        // Track maximum drift angle
        ds.maxAngle = Math.max(ds.maxAngle || 0, slipAmount);

        // Enhanced scoring with angle bonus
        const basePerSec = (speed * 30) + (slipAmount * 280) + (handbrake ? 100 : 0);
        const surfaceBonus = 1 + (1 - surfaceGrip) * 0.4;
        const streakBonus = 1 + Math.min((ds.streak - 1) * 0.25, 1.5);
        // NEW: Angle intensity bonus for more dramatic drifts
        const angleBonus = 1 + Math.min(slipAmount * 0.5, 0.4);

        ds.current += basePerSec * surfaceBonus * streakBonus * angleBonus * dt;
        if (handbrake) ds.hadHandbrake = true;
        ds.driftingNow = true;
    } else {
        if (ds.driftingNow) {
            const award = Math.round(ds.current);
            if (award >= DRIVE_PHYSICS.driftAwardMin) {
                ds.points += award;
                ds.lastAward = award;
                ds.bestCombo = Math.max(ds.bestCombo, award);

                // Enhanced style labels
                let style = "DRIFT";
                if (ds.hadHandbrake) style = "HB DRIFT";
                if ((ds.maxAngle || 0) > 0.5) style = ds.hadHandbrake ? "HB MANJI" : "MANJI";

                const streakTxt = ds.streak > 1 ? ` x${ds.streak}` : "";
                awardResult = { award, style, streakTxt };
            }
            ds.current = 0; ds.hadHandbrake = false; ds.maxAngle = 0;
        }
        ds.driftingNow = false;
    }
    return awardResult;
}

// ============================================================
// RESET
// ============================================================

export function freshVehicleState() {
    return {
        velX: 0, velZ: 0,
        angularVel: 0, steer: 0,
        lastLongAccel: 0, heading: 0,
        smoothThrottle: 0, smoothReverse: 0, smoothBrake: 0,
        wasHandbrake: false,
        weightTransferSpike: 0,
        isInDrift: false
    };
}

export function freshDriftState() {
    return {
        current: 0, driftingNow: false,
        streak: 0, streakTimer: 0,
        hadHandbrake: false,
        points: 0, lastAward: 0, bestCombo: 0,
        maxAngle: 0
    };
}