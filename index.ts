/* Library Imports */

import * as fs from "fs";
import * as path from "path";
import Handbrake from "handbrake-js";
import log from "single-line-log";
import * as readline from "readline";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

/* Class Imports */
import { File, Settings } from "./definitions/models.js";

let inputFiles: Array<File> = [];
let outputFiles: Array<File> = [];
let uncompressed: Array<File> = [];
let handbrakeInstance: Handbrake = null;
let processingFile: File = null;

//in the event of a exit, cancel and delete any files that are still processing
process.on("exit", exitHandler.bind(null, { cleanup: true, exit: true }));
process.on("SIGINT", exitHandler.bind(null, { cleanup: true, exit: true }));
process.on("SIGUSR1", exitHandler.bind(null, { cleanup: true, exit: true }));
process.on("SIGUSR2", exitHandler.bind(null, { cleanup: true, exit: true }));
process.on("uncaughtException", exitHandler.bind(null, { cleanup: true, exit: true }));

process.stdin.resume();

//load settings
let settings: Settings = new Settings();

if (!fs.existsSync(path.resolve("settings.json"))) {
    console.log(`\x1b[31mSettings file not found, create a settings.json file with the following structure:`);
    console.log(`
    {
        "inputPath": "",
        "outputPath": "",
        "presetName": "custom.json",
        "acceptedExtensions": ["mp4", "m4v"],
        "outputExtension": "mp4"
    }
    \x1b[0m`);
    waitForExit();
} else {
    try {
        settings = JSON.parse(fs.readFileSync(path.resolve("settings.json")).toString());

        if (!fs.existsSync(settings.outputPath)) {
            fs.mkdirSync(settings.outputPath);
        }
    } catch (error) {
        console.log(`\x1b[31mSettings file is not valid JSON, please check the settings.json file.\x1b[0m`);
        waitForExit();
    }

    if (!settings.inputPath) {
        console.log("\x1b[31mInput path not set in settings.json\x1b[0m");
        waitForExit();
    } else if (!settings.outputPath) {
        console.log("\x1b[31mOutput path not set in settings.json\x1b[0m");
        waitForExit();
    } else if (!settings.acceptedExtensions || settings.acceptedExtensions.length === 0) {
        console.log("\x1b[31mAccepted extensions not set in settings.json\x1b[0m");
        waitForExit();
    } else if (!settings.outputExtension) {
        console.log("\x1b[31mOutput extension not set in settings.json\x1b[0m");
        waitForExit();
    } else {
        //Get all files from the input directory
        inputFiles = getAllFiles(settings.inputPath);

        //Get all files from the output directory
        outputFiles = getAllFiles(settings.outputPath);

        //get difference between inputFiles and outputFiles by name
        uncompressed = getDifferenceByName(inputFiles, outputFiles);

        // current file that is being processed
        processingFile = null;

        // current handbrake cli instance that is processing a file
        handbrakeInstance = null;

        if (uncompressed.length > 0) {
            console.log(`Found ${uncompressed.length} videos to process`);
            processFile(0);
        } else {
            console.log("No videos to process");
            waitForExit();
        }
    }
}

//recursive proccessing of files
function processFile(fileIndex: number) {
    let file = uncompressed[fileIndex];

    if (file) {
        processingFile = file;
        let options: any = constructOptions(file);
        handbrakeInstance = Handbrake.spawn({ ...options, HandbrakeCLIPath: "./bin/HandbrakeCLI.exe" })
            .on("error", (err) => {
                // invalid user input, no video found etc
                console.log("\x1b[31m", err);
            })
            .on("progress", (progress) => {
                if (progress.percentComplete != 100) {
                    log.stdout(`\x1b[37mProcessing: \x1b[37m${file.name} \x1b[37m: ${progress.percentComplete}%`);
                } else {
                    log.stdout("\x1b[0m");
                    ResetLogColor();
                }
            })
            .on("end", () => {
                console.log(`\x1b[32mProcessed: ${file.name}`);
                if (fileIndex != uncompressed.length) {
                    processFile(fileIndex + 1);
                } else {
                    waitForExit();
                }
            })
            .on("cancelled", () => {
                //delete file
                log.stdout(`\x1b[31mCancelled: ${file.name}`);
                ResetLogColor();
                fs.unlinkSync(options.output);
                process.exit();
            });
    } else {
        ResetLogColor();
        throw "File not found";
    }
}

function constructOptions(file: File): Array<string> {
    let result: any = {};

    let presetPath = path.resolve("presets", settings.presetName);

    let preset = JSON.parse(fs.readFileSync(presetPath).toString());

    if (preset && preset.PresetList.length > 0) {
        result.input = file.path;
        result.output = path.resolve(settings.outputPath, file.name + "." + settings.outputExtension);
        result["preset-import-file"] = presetPath;
        result.preset = preset.PresetList[0].PresetName;
    } else {
        throw "Preset not found, or invalid.";
    }

    return result;
}

function getDifferenceByName(inputFiles: Array<File>, outputFiles: Array<File>): Array<File> {
    let result: Array<File> = [];

    result = inputFiles.filter((inputFile) => !outputFiles.find((outputFile) => outputFile.name == inputFile.name));

    return result;
}

function getAllFiles(path: string): Array<File> {
    let result: Array<File> = [];
    let files = fs.readdirSync(path);

    for (const file of files) {
        if (settings.acceptedExtensions.includes(file.split(".")[1])) {
            result.push({
                name: file.split(".")[0],
                path: path + "/" + file,
                extension: file.split(".")[1],
            });
        }
    }

    return result;
}

function ResetLogColor() {
    console.log("\x1b[0m");
}

function exitHandler(options, exitCode) {
    if (options.cleanup) {
        if (processingFile && handbrakeInstance) {
            handbrakeInstance.cancel();
        }
    } else {
        if (exitCode || exitCode === 0) console.log(exitCode);
        if (options.exit) process.exit();
    }
}
function waitForExit() {
    //so the program will not close instantly
    rl.question("Press any key to exit", () => {
        process.exit();
    });
}
