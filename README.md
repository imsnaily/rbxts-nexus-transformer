# @snailycfx/nexus-transformer

TypeScript compiler transformer for [@snailycfx/nexus](https://github.com/imsnaily/nexus-framework).

Automatically injects event parameter metadata at compile time, enabling
`@EventHandler()` to resolve event types without manual configuration.

## Installation
```bash
npm install @snailycfx/nexus-transformer
npx ts-patch install
```

## Setup

Add the transformer to your `tsconfig.json`:
```json
{
    "compilerOptions": {
        "plugins": [
            { "transform": "@snailycfx/nexus-transformer" }
        ]
    }
}
```

## How it works

The transformer scans your code at compile time for methods decorated
with `@EventHandler()` and injects a `NexusMetadata.define()` call
with the event class type automatically.

**Before:**
```typescript
@EventHandler()
public onWaveStarted(event: WaveStartedEvent): void {
    print(event.getWave())
}
```

**After (generated):**
```typescript
NexusMetadata.define("paramtypes", [WaveStartedEvent], target, "onWaveStarted")
@EventHandler()
public onWaveStarted(event: WaveStartedEvent): void {
    print(event.getWave())
}
```

## Requirements

- `typescript` >= 5.0.0
- `ts-patch` >= 3.0.0
- `@rbxts/nexus`

## License

MIT
