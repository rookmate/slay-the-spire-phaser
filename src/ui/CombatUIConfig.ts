export const COMBAT_UI_CONFIG = {
    layout: {
        cardSpacing: 70,
        handBaseY: 150,
        cardWidth: 120,
        cardHeight: 180,
        maxEnergyPerTurn: 3,
        handCurveHeight: 15,
        handRotationFactor: 0.08,
        siblingShift: 60,
        hoverLift: 50
    },
    styles: {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
        hpFontSize: '14px',
        iconFontSize: '24px'
    },
    animations: {
        hoverDuration: 100,
        damageNumberDuration: 1000,
        screenShakeDuration: 100,
        screenShakeIntensity: 0.004
    },
    depths: {
        hand: 200,
        handHover: 5000,
        dragPreview: 10001,
        dragCard: 10000,
        overlay: 2000,
        ui: 1000,
        targetHighlight: 100
    },
    colors: {
        background: 0x000000,
        overlay: 0x000000,
        overlayAlpha: 0.8,
        energyBg: '#222222',
        endTurnBg: '#550000',
        discardBg: '#333333',
        damage: 0xff4444,
        healing: 0x00ff00,
        targetHighlight: 0x00ff00,
        targetHighlightAlpha: 0.3
    },
    overlay: {
        cardScale: 0.5,
        cardWidth: 100,
        cardHeight: 140,
        columns: 6,
        padding: 16,
        titleHeight: 60
    }
} as const
