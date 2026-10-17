# SA-MP Launcher

Um launcher simples e funcional para **SA-MP**, desenvolvido em Electron e Node.js.

## Como usar

1. Clone este repositório

2. Instale as dependências:

```bash
npm install
npm install electron
npm install samp-query
```

3. Inicialize o `package.json` e edite para ficar assim:

```json
{
  "name": "samp-initalizer",
  "version": "1.0.0",
  "description": "Launcher simples para servidores de SA-MP.",
  "main": "src/js/main.js",
  "scripts": {
    "start": "electron ."
  },
  "dependencies": {
    "electron-store": "^8.2.0",
    "samp-query": "^0.1.5"
  },
  "devDependencies": {
    "electron": "^30.5.1"
  }
}
```

4. Configure os servidores no `src/js/config.json`

```json
{
  "gtaPath": "......",
  "servers": [
    {
      "name": "Base RP",
      "ip": "127.0.0.1",
      "port": 7777
    },
    {
      "name": "Base RP2",
      "ip": "127.0.0.2",
      "port": 7777
    }
  ]
}
```

5. Inicie o launcher:

```bash
npm start
```
