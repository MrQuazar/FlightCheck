import { Application } from 'pixi.js';
import './style.css';
import { GameManager } from './GameManager';

const app = new Application();

await app.init({
    resizeTo: window,
    background: '#1e1e1e',
});

document.body.appendChild(app.canvas);

const game = new GameManager(app);
await game.init();
