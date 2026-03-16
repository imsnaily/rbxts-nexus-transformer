// https://github.com/rbxts-flamework/transformer/blob/master/src/index.ts

import { existsSync } from "fs";
import Module from "module";
import path from "path";

const cwd = process.cwd();
const originalRequire = Module.prototype.require as NodeJS.Require;

function shouldHook(): boolean {
    if (!existsSync(path.join(cwd, "tsconfig.json"))) return false;
    if (!existsSync(path.join(cwd, "package.json"))) return false;
    if (!existsSync(path.join(cwd, "node_modules"))) return false;

    return true;
}

function tryResolve(id: string, basePath: string): string | undefined {
    try {
        return require.resolve(id, { paths: [basePath] });
    } catch {
        return undefined;
    }
}

function isDescendantOf(filePath: string, parentPath: string): boolean {
    const relative = path.relative(parentPath, filePath);
    return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function hook(): void {
    const robloxTsPath = tryResolve("roblox-ts", cwd);
    if (!robloxTsPath) return;

    const robloxTsTypeScriptPath = tryResolve("typescript", robloxTsPath);
    if (!robloxTsTypeScriptPath) return;

    const nexusTypeScript = require("typescript");
    const robloxTsTypeScript = require(robloxTsTypeScriptPath);
    if (nexusTypeScript === robloxTsTypeScript) return;

    ;(Module.prototype as NodeJS.Module).require = function nexusHook(
        this: NodeJS.Module,
        id: string,
    ) {
        if (id === "typescript" && isDescendantOf(this.filename, __dirname)) {
            return robloxTsTypeScript;
        }

        return originalRequire.call(this, id);
    } as NodeJS.Require
}

if (shouldHook()) {
    hook()
}

const transformer = require('./transformer');
Module.prototype.require = originalRequire;

export = transformer;