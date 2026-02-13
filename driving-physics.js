/**
 * driving-physics.js — Pure ES module for Art of Rally–style driving physics.
 *
 * Bicycle-model with:
 *   - Smooth Pacejka-like tire curves (not linear clamp)
 *   - Friction circle (traction vs lateral grip budget)
 *   - Tire load sensitivity
 *   - Engine braking & lift-off oversteer
 *   - Self-aligning torque
 *   - Weight transfer
 *   - Throttle/brake smoothing
 *   - Semi-implicit Euler integration
 *   - Surface grip, handbrake, drift scoring
 *
 * All functions are PURE — they take inputs and return outputs with no
 * DOM / Three.js / scene side-effects. The host applies the returned
 * values to the car object, state, and HUD.
 *
 * DRIFT TUNING PASS — key changes from original:
 *   - Pacejka C: 1.6 → 1.9 (steeper post-peak falloff, drifts sustain)
 *   - Rear stiffness B: 7.5 → 6.5 (wider peak angle, gentler buildup)
 *   - Front peakGrip: 1.30 → 0.98 (front was 12x rear force, killed drifts)
 *   - Rear falloff: 0.55 → 0.45 (deeper grip loss at extreme angles)
 *   - Friction circle: 0.85 → 0.65 (progressive, not binary)
 *   - Yaw damping: 1200 → 900 (rotation persists through drifts)
 *   - HB damping factor: 0.5 → 0.35 (more dramatic handbrake turns)
 *   - Lateral drag: 0.996 → 0.998 (slides sustain longer)
 *   - Counter-steer blend: 0.45 → 0.30 (less assist interference)
 *   - Drift thresholds lowered to match equilibrium slip ratios
 *   - Wheelspin-coupled damping relief (power oversteer sustains better)
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

        maxSteerAngle: 0.34,

        cornerStiffF: 8.0,
        cornerStiffR: 8.3,      // Firmer rear response for higher stability
        peakGripF: 1.14,        // A touch more front authority for crisp turn-in
        peakGripR: 1.34,        // More rear grip to reduce oversteer tendency
        falloffF: 0.85,
        falloffR: 0.72,         // Strong rear retention at high slip; easier to keep composed

        loadSensitivity: 0.15,

        engineForce: 35000,
        reverseForce: 15000,
        launchDriveMul: 1.45,
        brakeForce: 20000,
        engineBrakeForce: 3200,
        throttleResponse: 22.0,
        brakeResponse: 18.0,

        dragCoeff: 1.20,
        rollResistCoeff: 38,

        handbrakeGripMul: 0.16, // More controllable handbrake drifts (less instant spin)
        handbrakeBrakeForce: 4200,
        handbrakeEngineBrakeMul: 0.5,

        tractionGrip: 2.9,

        drivetrain: "rwd",
        awdFrontBias: 0.4,

        maxForwardSpeed: 62,
        maxReverseSpeed: 19,

        boostMultiplier: 1.7,

        yawDamping: 1500,        // More yaw stability for easier control

        frictionCircle: 0.28,    // Preserve even more lateral grip under throttle

        selfAligningTorque: 0.08,
        torqueReactionYaw: 0.0012
    },

    mazda: {
        drivetrain: "rwd", mass: 1180, inertia: 1700,
        engineForce: 35500,
        reverseForce: 15500,
        launchDriveMul: 1.35,
        cornerStiffF: 7.5, cornerStiffR: 7.0,
        peakGripF: 1.02, peakGripR: 1.10,  // Extra rear support for stability
        falloffR: 0.54,                     // More retained rear grip
        engineBrakeForce: 3000,
        torqueReactionYaw: 0.0042
    },
    sport: {
        drivetrain: "awd", mass: 1260, inertia: 1900,
        engineForce: 37000,
        reverseForce: 17500,
        launchDriveMul: 1.30,
        cornerStiffF: 8.0, cornerStiffR: 7.0,
        peakGripF: 1.03, peakGripR: 1.10,
        awdFrontBias: 0.42,
        maxForwardSpeed: 66,
        tractionGrip: 2.7,
        falloffR: 0.65,                     // AWD more stable but still driftable
        engineBrakeForce: 2800,
        torqueReactionYaw: 0.003
    }
};

export const DRIVE_PHYSICS = {
    gravity: 9.81,
    minSlipSpeed: 0.5,

    steerRate: 3.9,
    steerCenterRate: 5.0,
    counterSteerAssist: 3.2,
    counterSteerOversteerRatio: 1.05,
    counterSteerMinSlip: 0.03,
    counterSteerMinSpeed: 0.8,
    counterSteerBlend: 0.78,       // Strong catch but with smoother feel
    counterSteerYawBrake: 1.10,    // Keep driftable while still helping recovery

    lowSpeedThreshold: 2.5,
    lowSpeedAngDamping: 0.92,

    stopSpeed: 0.08,
    lateralDragFactor: 0.998,  // Was 0.996 — less lateral damping, drifts sustain better
    wheelspinLateralDragRelief: 0.04,
    wheelspinYawDampingRelief: 0.02,

    driftSlipThreshold: 0.12,          // Slightly lower so sustained low-angle slides register
    driftSlipThresholdTarmac: 0.14,    // Tarmac power oversteer should register
    driftSlipThresholdHandbrake: 0.09, // Handbrake transitions should not miss by tiny margins
    driftMinSpeed: 4.5,
    driftAwardMin: 140,
    driftStreakWindow: 2.4
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

// ============================================================
// PACEJKA-LIKE TIRE CURVE
// ============================================================

function tireForce(slipAngle, B, D, falloff) {
    // C=1.9: steeper falloff past peak → drifts sustain instead of snapping back
    // (was 1.6 — curve stayed at 90%+ even at 20° slip, making drifts impossible)
    const C = 1.9;
    const rawNorm = Math.sin(C * Math.atan(B * slipAngle));

    const absNorm = Math.abs(rawNorm);
    const absSlip = Math.abs(slipAngle);

    // Only apply the floor when past the peak (roughly slip > 0.2 rad / 11°)
    if (absSlip > 0.18 && absNorm < falloff) {
        // Blend toward the floor to prevent force from cratering
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

    const prevSmThrottle = vehicle.smoothThrottle || 0;
    const prevSmReverse = vehicle.smoothReverse || 0;
    const prevSmBrake = vehicle.smoothBrake || 0;

    const thAlpha = 1 - Math.exp(-tune.throttleResponse * dt);
    const brAlpha = 1 - Math.exp(-tune.brakeResponse * dt);

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

    const speedNorm = Math.min(speed / (tune.maxForwardSpeed * boostMul), 1);
    const speedFactor = 1 - speedNorm * speedNorm * 0.45;
    const effectiveMaxSteer = tune.maxSteerAngle * speedFactor;
    const targetSteer = steerInput * effectiveMaxSteer;
    let curSteer = vehicle.steer || 0;
    const steerStep = DRIVE_PHYSICS.steerRate * dt;
    if (Math.abs(targetSteer - curSteer) <= steerStep) curSteer = targetSteer;
    else curSteer += Math.sign(targetSteer - curSteer) * steerStep;
    if (Math.abs(steerInput) < 0.01) curSteer -= curSteer * DRIVE_PHYSICS.steerCenterRate * dt;
    curSteer = clamp(curSteer, -effectiveMaxSteer, effectiveMaxSteer);

    const frontSlip = Math.atan2(
        localVy + angularVel * tune.cgToFront, absVx
    ) - driveSign * curSteer;

    const rearSlip = Math.atan2(
        localVy - angularVel * tune.cgToRear, absVx
    );

    let oversteerCatch = 0;
    if (DRIVE_PHYSICS.counterSteerAssist > 0
        && Math.abs(localVx) > DRIVE_PHYSICS.counterSteerMinSpeed) {
        const absR = Math.abs(rearSlip);
        const absF = Math.abs(frontSlip);
        const isOversteer = absR > absF * DRIVE_PHYSICS.counterSteerOversteerRatio
                         && absR > DRIVE_PHYSICS.counterSteerMinSlip;
        if (isOversteer) {
            const counterAngle = Math.atan2(localVy, absVx);
            const assistAmt = Math.min(1, DRIVE_PHYSICS.counterSteerAssist * dt);
            curSteer = lerp(curSteer, -counterAngle,
                            assistAmt * DRIVE_PHYSICS.counterSteerBlend);
            // Scale 0..1 by how far rear slip exceeds the activation threshold.
            oversteerCatch = clamp(
                (absR - DRIVE_PHYSICS.counterSteerMinSlip) / 0.22,
                0,
                1
            );
        }
    }

    const wheelBase = tune.cgToFront + tune.cgToRear;
    const baseFront = tune.mass * (tune.cgToRear / wheelBase);
    const baseRear = tune.mass * (tune.cgToFront / wheelBase);
    const wt = (vehicle.lastLongAccel * tune.mass * tune.cgHeight) / (wheelBase * G);
    const weightFront = clamp(baseFront + wt, tune.mass * 0.1, tune.mass * 0.9);
    const weightRear = clamp(baseRear - wt, tune.mass * 0.1, tune.mass * 0.9);

    const ls = tune.loadSensitivity || 0;
    const fLoadScale = 1 - ls * (weightFront / baseFront - 1);
    const rLoadScale = 1 - ls * (weightRear / baseRear - 1);

    const frontPeakF = tune.peakGripF * fLoadScale * weightFront * G * surfaceGrip;
    const rearPeakF = tune.peakGripR * rLoadScale * weightRear * G * surfaceGrip;

    const launchMulBase = tune.launchDriveMul || 1.0;
    const launchFade = smoothstep(2, 16, Math.abs(localVx));
    const launchMul = lerp(launchMulBase, 1.0, launchFade);
    const forwardDriveForce = smoothThrottle * tune.engineForce * boostMul * launchMul;
    const reverseDriveForce = -smoothReverse * (tune.reverseForce || (tune.engineForce * 0.55)) * launchMul;
    const driveForce = forwardDriveForce + reverseDriveForce;
    const brakeForce = smoothBrake * tune.brakeForce;

    let engineBrakeF = 0;
    if (smoothThrottle < 0.1 && smoothReverse < 0.1 && Math.abs(localVx) > 1.0) {
        const ebScale = 1 - Math.max(smoothThrottle, smoothReverse) / 0.1;
        const spScale = Math.min(Math.abs(localVx) / 15, 1);
        engineBrakeF = tune.engineBrakeForce * ebScale * spScale;
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

    if (handbrake && Math.abs(localVx) > 0.2) {
        rearTrac += -sign(localVx) * tune.handbrakeBrakeForce;
        if (tune.drivetrain !== "fwd") {
            rearTrac += -sign(localVx) * tune.engineBrakeForce * (tune.handbrakeEngineBrakeMul || 0.5);
        }
    }

    const maxFTrac = weightFront * G * surfaceGrip * tune.tractionGrip;
    const maxRTrac = weightRear * G * surfaceGrip * tune.tractionGrip;
    const frontDemand = Math.abs(frontTrac);
    const rearDemand = Math.abs(rearTrac);
    frontTrac = clamp(frontTrac, -maxFTrac, maxFTrac);
    rearTrac = clamp(rearTrac, -maxRTrac, maxRTrac);

    // Estimate wheelspin from demand beyond available traction on driven axle.
    const fSpinExcess = maxFTrac > 0 ? Math.max(0, frontDemand / maxFTrac - 1) : 0;
    const rSpinExcess = maxRTrac > 0 ? Math.max(0, rearDemand / maxRTrac - 1) : 0;
    let drivenSpinExcess;
    if (tune.drivetrain === "fwd") drivenSpinExcess = fSpinExcess;
    else if (tune.drivetrain === "awd") {
        drivenSpinExcess = fSpinExcess * tune.awdFrontBias + rSpinExcess * (1 - tune.awdFrontBias);
    } else drivenSpinExcess = rSpinExcess;
    const wheelspin01 = clamp(drivenSpinExcess / (1 + drivenSpinExcess), 0, 1);

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

    let frontLat = -tireForce(frontSlip, tune.cornerStiffF, fLatPeak, tune.falloffF);
    let rearLat = -tireForce(rearSlip, tune.cornerStiffR, rLatPeak, tune.falloffR);

    if (handbrake) rearLat *= tune.handbrakeGripMul;

    const totalTrac = frontTrac + rearTrac;
    const dragF = -tune.dragCoeff * localVx * Math.abs(localVx);
    const rollR = -tune.rollResistCoeff * getSurfaceRollingMul(surfaceType) * localVx;
    const totalLong = totalTrac + dragF + rollR;

    const cosS = Math.cos(curSteer);
    const forceX = totalLong;
    const forceY = cosS * frontLat + rearLat;
    let rawYaw = tune.cgToFront * cosS * frontLat - tune.cgToRear * rearLat;
    if (Math.abs(curSteer) > 0.02 && smoothThrottle > 0.05 && Math.abs(localVx) > 2) {
        // Arcade-style throttle-on rotation helper; fades at very low speed.
        const yawSpeedFactor = smoothstep(1.5, 16, Math.abs(localVx));
        const yawBoost = (tune.torqueReactionYaw || 0) * tune.engineForce * smoothThrottle * yawSpeedFactor;
        rawYaw += sign(curSteer) * yawBoost;
    }

    const sat = tune.selfAligningTorque || 0;
    let satTorque = 0;
    if (sat > 0 && speed > 1) {
        const satMag = Math.abs(frontLat) * (1 - smoothstep(0.15, 0.6, Math.abs(frontSlip)));
        satTorque = -sign(frontSlip) * satMag * sat;
    }

    const spDamp = 0.3 + Math.min(Math.abs(localVx) / 20, 1) * 0.7;
    const hbDamp = handbrake ? 0.35 : 1.0;   // Was 0.5 — less damping during HB for bigger rotation
    const spinYawRelief = 1 - wheelspin01 * (DRIVE_PHYSICS.wheelspinYawDampingRelief || 0);
    const catchDamp = 1 + oversteerCatch * (DRIVE_PHYSICS.counterSteerYawBrake || 0);
    const yawDamp = (tune.yawDamping || 0) * hbDamp * spDamp * spinYawRelief * catchDamp;
    const yawTorque = rawYaw + satTorque - angularVel * yawDamp;

    const wFx = fwdX * forceX + rightX * forceY;
    const wFz = fwdZ * forceX + rightZ * forceY;

    velX += (wFx / tune.mass) * dt;
    velZ += (wFz / tune.mass) * dt;
    angularVel += (yawTorque / tune.inertia) * dt;

    const lsBlend = 1 - smoothstep(0, DRIVE_PHYSICS.lowSpeedThreshold, speed);
    if (lsBlend > 0) {
        angularVel *= lerp(1, DRIVE_PHYSICS.lowSpeedAngDamping, lsBlend);
    }

    if (speed < DRIVE_PHYSICS.stopSpeed && smoothThrottle < 0.01
        && smoothReverse < 0.01 && smoothBrake < 0.01 && !handbrake) {
        velX = 0; velZ = 0; angularVel = 0;
    }

    localVx = velX * fwdX + velZ * fwdZ;
    localVy = velX * rightX + velZ * rightZ;
    localVx = clamp(localVx, -tune.maxReverseSpeed, tune.maxForwardSpeed * boostMul);
    const latDragRelief = clamp(wheelspin01 * (DRIVE_PHYSICS.wheelspinLateralDragRelief || 0), 0, 1);
    const dynamicLateralDrag = lerp(DRIVE_PHYSICS.lateralDragFactor, 1.0, latDragRelief);
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
        surfaceType
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
// DRIFT SCORING
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
        }
        const basePerSec = (speed * 28) + (slipAmount * 230) + (handbrake ? 90 : 0);
        const surfaceBonus = 1 + (1 - surfaceGrip) * 0.35;
        const streakBonus = 1 + Math.min((ds.streak - 1) * 0.2, 1.2);
        ds.current += basePerSec * surfaceBonus * dt * streakBonus;
        if (handbrake) ds.hadHandbrake = true;
        ds.driftingNow = true;
    } else {
        if (ds.driftingNow) {
            const award = Math.round(ds.current);
            if (award >= DRIVE_PHYSICS.driftAwardMin) {
                ds.points += award;
                ds.lastAward = award;
                ds.bestCombo = Math.max(ds.bestCombo, award);
                const style = ds.hadHandbrake ? "HB DRIFT" : "DRIFT";
                const streakTxt = ds.streak > 1 ? ` · STREAK x${ds.streak}` : "";
                awardResult = { award, style, streakTxt };
            }
            ds.current = 0; ds.hadHandbrake = false;
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
        smoothThrottle: 0, smoothReverse: 0, smoothBrake: 0
    };
}

export function freshDriftState() {
    return {
        current: 0, driftingNow: false,
        streak: 0, streakTimer: 0,
        hadHandbrake: false,
        points: 0, lastAward: 0, bestCombo: 0
    };
}