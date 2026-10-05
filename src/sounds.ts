import clockUrl from './assets/audios/dragon-studio-clock-ticking-down-376897-[AudioTrimmer.com].mp3';
import correctUrl from './assets/audios/dragon-studio-correct-472358.mp3';
import wrongUrl from './assets/audios/universfield-wrong-answer-126515.mp3';
import winUrl from './assets/audios/puyopuyomegafan1234-winner-game-sound-404167.mp3';

function makeSound(url: string, loop = false): HTMLAudioElement {
    const audio = new Audio(url);
    audio.loop = loop;
    audio.preload = 'auto';
    return audio;
}

/** Small wrapper around the four game SFX. */
export class Sounds {
    private readonly clock = makeSound(clockUrl, true);
    private readonly correct = makeSound(correctUrl);
    private readonly wrong = makeSound(wrongUrl);
    private readonly win = makeSound(winUrl);

    startClock() {
        this.clock.currentTime = 0;
        void this.clock.play().catch(() => {
            // Browser may block until a user gesture; menu click usually unlocks it.
        });
    }

    stopClock() {
        this.clock.pause();
        this.clock.currentTime = 0;
    }

    playCorrect() {
        this.playOneShot(this.correct);
    }

    playWrong() {
        this.playOneShot(this.wrong);
    }

    playWin() {
        this.stopClock();
        this.playOneShot(this.win);
    }

    private playOneShot(audio: HTMLAudioElement) {
        audio.pause();
        audio.currentTime = 0;
        void audio.play().catch(() => {
            // Ignore autoplay / missing-file failures during learning.
        });
    }
}
