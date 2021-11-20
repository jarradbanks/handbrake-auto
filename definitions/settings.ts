export class Settings {
    //input path for Medal clips
    inputPath: string;
    //output path for compressed Medal clips through handbrake
    outputPath: string;
    //preset for handbrake (see https://handbrake.fr/docs/en/latest/cli/cli-presets.html)
    presetName: string = "custom.json";
    //any extensions that are accepted for processing
    acceptedExtensions: Array<string> = ["mp4", "mkv"];
    //desired extension for compressed video
    outputExtension: string = "mp4";
}
