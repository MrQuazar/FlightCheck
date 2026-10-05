import { Container, Graphics, Text } from 'pixi.js';

export class MainMenu extends Container {
    private selectHandler: ((playerCount: 1 | 2 | 3 | 4) => void) | null = null;

    constructor() {
        super();

        const title = new Text({
            text: 'Flight Check',
            style: {
                fill: 0xffffff,
                fontSize: 42,
                fontFamily: 'Arial',
                fontWeight: 'bold',
            },
        });
        title.anchor.set(0.5);
        title.y = -120;
        this.addChild(title);

        const subtitle = new Text({
            text: 'Press when it can fly. Stay still when it cannot.',
            style: {
                fill: 0xbbbbbb,
                fontSize: 16,
                fontFamily: 'Arial',
            },
        });
        subtitle.anchor.set(0.5);
        subtitle.y = -70;
        this.addChild(subtitle);

        const options: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];
        options.forEach((count, index) => {
            const button = this.createMenuButton(`${count}P`, 0, -10 + index * 70, () => {
                this.selectHandler?.(count);
            });
            this.addChild(button);
        });

        this.pivot.set(0, 40);
    }

    onSelect(handler: (playerCount: 1 | 2 | 3 | 4) => void) {
        this.selectHandler = handler;
    }

    resize(width: number, height: number) {
        const scale = Math.min(1.25, width / 300, height / 480);
        this.scale.set(Math.max(0.35, scale));
    }

    private createMenuButton(label: string, x: number, y: number, onPress: () => void) {
        const button = new Container();
        button.x = x;
        button.y = y;

        const width = 180;
        const height = 52;

        const bg = new Graphics()
            .roundRect(-width / 2, -height / 2, width, height, 10)
            .fill(0x3d7eff);

        const text = new Text({
            text: label,
            style: {
                fill: 0xffffff,
                fontSize: 22,
                fontFamily: 'Arial',
                fontWeight: 'bold',
            },
        });
        text.anchor.set(0.5);

        button.addChild(bg, text);
        button.eventMode = 'static';
        button.cursor = 'pointer';
        button.on('pointertap', onPress);
        button.on('pointerdown', () => button.scale.set(0.96));
        button.on('pointerup', () => button.scale.set(1));
        button.on('pointerupoutside', () => button.scale.set(1));

        return button;
    }
}
