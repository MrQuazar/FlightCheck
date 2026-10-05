import gsap from 'gsap';
import { Container, Graphics, Text } from 'pixi.js';

export type PlayerId = 1 | 2 | 3 | 4;

export type PlayerSlot = {
    id: PlayerId;
    label: string;
    key: string;
    keyCode: string;
};

/** Fixed board positions + keyboard fallbacks for each player. */
export const PLAYER_SLOTS: PlayerSlot[] = [
    { id: 1, label: 'P1', key: '1', keyCode: 'Digit1' },
    { id: 2, label: 'P2', key: '2', keyCode: 'Digit2' },
    { id: 3, label: 'P3', key: '3', keyCode: 'Digit3' },
    { id: 4, label: 'P4', key: '4', keyCode: 'Digit4' },
];

type BoardButton = Container & {
    bg: Graphics;
    caption: Text;
    enabled: boolean;
    pressed: boolean;
    homeX: number;
    homeY: number;
};

/**
 * GameBoard: center text panel + up to 4 player buttons (top / bottom / left / right).
 */
export class GameBoard extends Container {
    private readonly centerPanel: Container;
    private readonly panelBg: Graphics;
    private readonly display: Text;
    private readonly buttons = new Map<PlayerId, BoardButton>();
    private readonly boardSize = 280;
    private readonly buttonSize = 72;
    private readonly gap = 16;
    private viewWidth = 800;
    private pressHandler: ((playerId: PlayerId) => void) | null = null;

    constructor() {
        super();

        this.centerPanel = new Container();
        this.panelBg = this.createPanelBg(0x2a2a2a, 0x555555);
        this.display = this.createDisplay();
        this.centerPanel.addChild(this.panelBg, this.display);
        this.addChild(this.centerPanel);

        const positions: Record<PlayerId, { x: number; y: number }> = {
            1: { x: 0, y: this.upY() },
            2: { x: 0, y: this.downY() },
            3: { x: this.leftX(), y: 0 },
            4: { x: this.rightX(), y: 0 },
        };

        for (const slot of PLAYER_SLOTS) {
            const pos = positions[slot.id];
            const button = this.createButton(slot, pos.x, pos.y);
            this.buttons.set(slot.id, button);
            this.addChild(button);
        }
    }

    setText(value: string) {
        this.display.text = value;
    }

    /** Scale the board to the viewport so layout stays usable when the window changes. */
    resize(width: number, height: number) {
        this.viewWidth = width;
        const footprint = this.boardSize + (this.gap + this.buttonSize) * 2;
        const scaleX = (width * 0.9) / footprint;
        const scaleY = (height * 0.7) / footprint;
        const scale = Math.min(1.35, scaleX, scaleY);
        this.scale.set(Math.max(0.35, scale));
    }

    onPlayerPress(handler: (playerId: PlayerId) => void) {
        this.pressHandler = handler;
    }

    /** Show only the first `count` players; hide the rest. */
    setPlayerCount(count: number) {
        for (const slot of PLAYER_SLOTS) {
            const button = this.buttons.get(slot.id)!;
            button.visible = slot.id <= count;
        }
    }

    setPlayerEnabled(playerId: PlayerId, enabled: boolean) {
        const button = this.buttons.get(playerId);
        if (!button || !button.visible) {
            return;
        }

        const slot = PLAYER_SLOTS.find((s) => s.id === playerId);
        button.enabled = enabled;
        button.pressed = false;
        button.eventMode = enabled ? 'static' : 'none';
        button.cursor = enabled ? 'pointer' : 'default';
        button.alpha = enabled ? 1 : 0.35;
        button.scale.set(1);
        button.caption.text = slot?.label ?? button.caption.text;
        this.paintButton(button, enabled ? 0x3d7eff : 0x555555);
    }

    /** Locked-in look after a valid press — stops further clicks for that player. */
    markPressed(playerId: PlayerId) {
        const button = this.buttons.get(playerId);
        if (!button || !button.visible || !button.enabled || button.pressed) {
            return;
        }

        button.pressed = true;
        button.eventMode = 'none';
        button.cursor = 'default';
        gsap.killTweensOf(button.scale);
        button.scale.set(0.9);
        this.paintButton(button, 0x1abc9c);
        button.caption.text = '✓';
    }

    /** Clear round presses for living players before the next prompt. */
    clearPressed(playerId: PlayerId) {
        const button = this.buttons.get(playerId);
        if (!button || !button.visible || !button.enabled) {
            return;
        }

        const slot = PLAYER_SLOTS.find((s) => s.id === playerId);
        button.pressed = false;
        button.eventMode = 'static';
        button.cursor = 'pointer';
        button.scale.set(1);
        button.caption.text = slot?.label ?? button.caption.text;
        this.paintButton(button, 0x3d7eff);
    }

    resetPlayers(count: number) {
        gsap.killTweensOf(this.centerPanel);
        this.centerPanel.x = 0;
        this.centerPanel.y = 0;
        this.centerPanel.scale.set(1);
        this.paintPanel(0x2a2a2a, 0x555555);

        this.setPlayerCount(count);
        for (const slot of PLAYER_SLOTS) {
            if (slot.id <= count) {
                const button = this.buttons.get(slot.id)!;
                gsap.killTweensOf(button);
                gsap.killTweensOf(button.scale);
                button.x = button.homeX;
                button.y = button.homeY;
                button.rotation = 0;
                button.scale.set(1);
                button.caption.text = slot.label;
                this.setPlayerEnabled(slot.id, true);
            }
        }
    }

    /** Shake / wiggle — used for an incorrect answer. */
    playIncorrect(playerId: PlayerId): Promise<void> {
        const button = this.buttons.get(playerId);
        if (!button) return Promise.resolve();

        gsap.killTweensOf(button);
        button.x = button.homeX;
        button.rotation = 0;

        return new Promise((resolve) => {
            gsap.timeline({
                onComplete: () => {
                    button.x = button.homeX;
                    button.rotation = 0;
                    resolve();
                },
            })
                .to(button, { x: button.homeX + 10, rotation: 0.05 })
                .to(button, { x: button.homeX - 10, duration: 0.05 })
                .to(button, { x: button.homeX + 8, duration: 0.05 })
                .to(button, { x: button.homeX - 8, duration: 0.05 })
                .to(button, { x: button.homeX + 4, duration: 0.05 })
                .to(button, { x: button.homeX, duration: 0.05 })
                .to(button, { rotation: 0.12, duration: 0.06 }, 0)
                .to(button, { rotation: -0.12, duration: 0.08 }, 0.06)
                .to(button, { rotation: 0, duration: 0.06 });
        });
    }

    /** Scale pulse wave — used for a correct answer. */
    playCorrect(playerId: PlayerId): Promise<void> {
        const button = this.buttons.get(playerId);
        if (!button) return Promise.resolve();

        gsap.killTweensOf(button.scale);
        button.scale.set(1);

        return new Promise((resolve) => {
            gsap.timeline({
                onComplete: () => {
                    button.scale.set(1);
                    resolve();
                },
            })
                .to(button.scale, { x: 1.25, y: 1.25, duration: 0.14, ease: 'power2.out' })
                .to(button.scale, { x: 0.92, y: 0.92, duration: 0.12, ease: 'power1.inOut' })
                .to(button.scale, { x: 1.08, y: 1.08, duration: 0.1, ease: 'power1.inOut' })
                .to(button.scale, { x: 1, y: 1, duration: 0.12, ease: 'power2.out' });
        });
    }

    /**
     * All players passed: panel turns green, exits right, re-enters from left.
     * `screenWidth` is used so the travel distance matches the viewport.
     */
    playAllPassed(screenWidth: number = this.viewWidth): Promise<void> {
        gsap.killTweensOf(this.centerPanel);
        this.centerPanel.x = 0;
        this.paintPanel(0x2ecc71, 0xa8ffce);

        const localScale = this.scale.x || 1;
        const exitX = screenWidth / (2 * localScale) + this.boardSize;
        const enterX = -exitX;

        return new Promise((resolve) => {
            gsap.timeline({
                onComplete: () => {
                    this.centerPanel.x = 0;
                    this.paintPanel(0x2a2a2a, 0x555555);
                    resolve();
                },
            })
                .to(this.centerPanel, {
                    x: exitX,
                    duration: 0.45,
                    ease: 'power2.in',
                })
                .set(this.centerPanel, { x: enterX })
                .to(this.centerPanel, {
                    x: 0,
                    duration: 0.45,
                    ease: 'power2.out',
                });
        });
    }

    /** Last player standing — button grows large to celebrate the win. */
    playWinner(playerId: PlayerId): Promise<void> {
        const button = this.buttons.get(playerId);
        if (!button) return Promise.resolve();

        gsap.killTweensOf(button);
        gsap.killTweensOf(button.scale);
        button.x = button.homeX;
        button.y = button.homeY;
        button.rotation = 0;
        this.paintButton(button, 0xf1c40f);
        button.alpha = 1;

        return new Promise((resolve) => {
            gsap.to(button.scale, {
                x: 2.4,
                y: 2.4,
                duration: 0.7,
                ease: 'back.out(1.6)',
                onComplete: () => resolve(),
            });
        });
    }

    private createDisplay() {
        const text = new Text({
            text: 'Ready',
            style: {
                fill: 0xffffff,
                fontSize: 32,
                fontFamily: 'Arial',
                fontWeight: 'bold',
                wordWrap: true,
                wordWrapWidth: this.boardSize - 24,
                align: 'center',
            },
        });
        text.anchor.set(0.5);
        return text;
    }

    private createPanelBg(fill: number, stroke: number) {
        const bg = new Graphics();
        this.drawPanel(bg, fill, stroke);
        return bg;
    }

    private paintPanel(fill: number, stroke: number) {
        this.drawPanel(this.panelBg, fill, stroke);
    }

    private drawPanel(gfx: Graphics, fill: number, stroke: number) {
        gfx.clear()
            .roundRect(
                -this.boardSize / 2,
                -this.boardSize / 2,
                this.boardSize,
                this.boardSize,
                12,
            )
            .fill(fill)
            .stroke({ width: 2, color: stroke });
    }

    private createButton(slot: PlayerSlot, x: number, y: number): BoardButton {
        const button = new Container() as BoardButton;
        button.x = x;
        button.y = y;
        button.homeX = x;
        button.homeY = y;
        button.enabled = true;
        button.pressed = false;

        const bg = new Graphics();
        button.bg = bg;
        this.paintButton(button, 0x3d7eff);

        const caption = new Text({
            text: slot.label,
            style: {
                fill: 0xffffff,
                fontSize: 18,
                fontFamily: 'Arial',
                fontWeight: 'bold',
            },
        });
        caption.anchor.set(0.5);
        button.caption = caption;

        button.addChild(bg, caption);
        button.eventMode = 'static';
        button.cursor = 'pointer';

        button.on('pointertap', () => {
            if (button.enabled && !button.pressed) {
                this.pressHandler?.(slot.id);
            }
        });

        button.on('pointerdown', () => {
            if (button.enabled && !button.pressed && !gsap.isTweening(button.scale)) {
                button.scale.set(0.92);
            }
        });
        button.on('pointerup', () => {
            if (!button.pressed && !gsap.isTweening(button.scale)) {
                button.scale.set(1);
            }
        });
        button.on('pointerupoutside', () => {
            if (!button.pressed && !gsap.isTweening(button.scale)) {
                button.scale.set(1);
            }
        });

        return button;
    }

    private paintButton(button: BoardButton, color: number) {
        button.bg.clear()
            .roundRect(
                -this.buttonSize / 2,
                -this.buttonSize / 2,
                this.buttonSize,
                this.buttonSize,
                10,
            )
            .fill(color);
    }

    private upY() {
        return -this.boardSize / 2 - this.gap - this.buttonSize / 2;
    }

    private downY() {
        return this.boardSize / 2 + this.gap + this.buttonSize / 2;
    }

    private leftX() {
        return -this.boardSize / 2 - this.gap - this.buttonSize / 2;
    }

    private rightX() {
        return this.boardSize / 2 + this.gap + this.buttonSize / 2;
    }
}
