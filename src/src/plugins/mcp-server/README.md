# Elainatheme League client MCP

This integration gives coding agents a live development view of the League client through Pengu Loader. It adapts [Rumi's league-client-mcp](https://github.com/rumi-chan/league-client-mcp), retains its 16 tools, and adds console and network inspection. Rumi's MIT notice is included in `LICENSE-RUMI.txt`.

## Start the service

1. Install Node.js 20 or newer, including npm.
2. In Elainatheme, unlock developer settings by clicking the Plugins Settings logo 20 times, enable Dev-mode, and follow the theme's restart prompt if needed.
3. In Plugins Settings → Developer MCP server, choose **Open MCP server folder**.
4. On Windows, run `start.bat`. On macOS, run `sh start.sh` from Terminal (or make it executable and run `./start.sh`). The script changes to its own folder, installs dependencies on first use or lockfile changes, builds, and starts the service in the foreground. Keep that terminal open; Ctrl+C stops the server.
5. Enable **AI access through MCP**. This switch is independent of Dev-mode and defaults to off.

You can also run the commands yourself inside this folder:

```sh
npm ci
npm run build
npm start
```

The service listens only on `127.0.0.1`. The default URL is `http://127.0.0.1:8080/mcp`, with a renderer WebSocket bridge at `ws://127.0.0.1:8080/bridge`. First startup creates `config.local.json` from the shipped example and generates a random bearer token. The token is never printed to the terminal.

The bridge accepts Pengu's local plugin origins and League's HTTPS loopback origin (for example, `https://127.0.0.1:53262` on Pengu 1.1.6). League's port changes between launches and does not need to match the MCP port. The bridge still requires the configuration token before accepting commands; HTTP MCP retains its separate Host/Origin checks and bearer authentication.

## Configuration and Pengu versions

`config.local.json` is the only source of listener/authentication/export configuration:

```json
{
  "schemaVersion": 1,
  "port": 8080,
  "token": "YOUR_GENERATED_TOKEN_FROM_CONFIG_LOCAL_JSON",
  "penguPluginsPath": ""
}
```

Use the generated token, not the illustrative text above. An empty export directory disables export. To enable it, set an absolute path to the intended Pengu plugins directory. Changing port or token requires stopping and restarting the external service, then reconnecting the theme. The export path is reread from the file for each export.

| Setting | Pengu 1.1.6 | Pengu 1.2+ with PluginFS |
| --- | --- | --- |
| MCP enable, console/network/payload capture, buffer/payload limits | Editable through ElainaData/DataStore | Editable through ElainaData |
| Port, authentication token, export directory | Read from the JSON file; edit directly on disk | Editable JSON controls in Plugins Settings |
| Status, reconnect, clear capture, open folder | Available in Dev-mode | Available in Dev-mode |

Installations without usable PluginFS follow the legacy path even if their version is newer. No file-based configuration or token is copied into the datastore or portable backups. New PluginFS installations can initialize the JSON from settings before the server starts. Failed reads, invalid JSON, and failed writes are reported without applying a partial configuration.

MCP settings are absent when Dev-mode is off. Capture and bridge access stop immediately when Dev-mode or MCP is disabled. Normal theme rebuilds preserve the installed server dependencies and local JSON configuration.

## Connect an AI client

For clients with Streamable HTTP support, register the URL and the bearer header. Claude Code uses an HTTP entry such as:

```json
{
  "mcpServers": {
    "elainatheme": {
      "type": "http",
      "url": "http://127.0.0.1:8080/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

Gemini CLI uses `httpUrl` for Streamable HTTP:

```json
{
  "mcpServers": {
    "elainatheme": {
      "httpUrl": "http://127.0.0.1:8080/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

The token comes from `config.local.json`. For Claude Desktop or any client that requires a local command, use the bundled stdio adapter:

```json
{
  "mcpServers": {
    "elainatheme": {
      "command": "node",
      "args": ["C:/your/Pengu/plugins/elaina-theme/mcp-server/dist/server/stdio.js"]
    }
  }
}
```

Use your actual deployed folder, including any `@scope`. The adapter reads the adjacent package's `config.local.json` and connects to the already running service. It never starts another listener. On macOS use an absolute `/.../mcp-server/dist/server/stdio.js` path.

For Codex, the same adapter can be configured as a local MCP command:

```toml
[mcp_servers.elainatheme]
command = "node"
args = ["C:/your/Pengu/plugins/elaina-theme/mcp-server/dist/server/stdio.js"]
```

See the [official MCP configuration reference](https://developers.openai.com/codex/mcp) for client configuration details.

## Tools and development loop

The upstream tools are `get_lol_dom_snapshot`, `query_lol_element`, `wait_for_lol_element`, `inject_lol_css`, `execute_lol_javascript`, `inject_lol_plugin`, `reload_lol_plugin`, `remove_lol_plugin`, `export_plugin_to_pengu`, `click_lol_element`, `type_into_lol_element`, `get_lol_client_state`, `get_lol_performance_metrics`, `get_lol_screenshot`, `reload_lol_client`, and `lcu_request`.

The five added tools are:

| Tool | Behavior |
| --- | --- |
| `get_lol_console_logs` | Cursor pagination, level and text filters; includes browser errors and unhandled rejections |
| `clear_lol_console_logs` | Clears console capture |
| `get_lol_network_logs` | Paginated summaries; filter by kind, URL/error text, method or status |
| `get_lol_network_entry` | Read headers, payloads, errors and timings for a returned ID |
| `clear_lol_network_logs` | Clears network capture |

For pagination, pass the returned `nextCursor` as the next call's `cursor`. Default pages contain 50 entries, maximum 100. Results report `hasMore`, `oldestCursor`, and the number of dropped records. IDs do not reset on clear; evicted or cleared network IDs return an explicit error.

Inspect the DOM before choosing selectors. Use CSS or named JavaScript previews to verify the proposed behavior. Persistent preview code must return a cleanup function; it receives an AbortSignal named `signal`. Then use the coding agent's workspace tools to edit the actual Elainatheme TypeScript/CSS, run the theme build, call `reload_lol_client`, and inspect the client again. Workspace editing/building is intentionally handled by the coding agent's existing tools. `export_plugin_to_pengu` exports a preview as a separate Pengu module and reads its destination from the file configuration; it does not build Elainatheme source.

All agents share one League renderer. Mutating commands are serialized. Bridge calls time out at 15 seconds; element waits are limited to 13 seconds. Screenshots return a PNG plus a temporary path on Windows. macOS returns an explicit unsupported-platform error.

## Capture behavior and limits

Capture starts when Dev-mode and MCP are both enabled, including while the Node service is offline. It covers console methods, renderer fetch/XHR requests and responses, newly created WebSocket message listeners, WebSocket sends, LCU API events, and resource timing metadata for assets. It does not observe other processes or native Riot network traffic.

Full payloads are enabled by default. Each buffer keeps at most 500 entries, each payload at most 64 KiB, and total buffered data at most 2 MiB for console and 16 MiB for network. Text/JSON is returned as text; bounded binary data is base64. Opaque responses, resource timing bodies, streamed requests that cannot be safely copied, concurrent capture saturation, and timeouts have explicit omission reasons. Body capture is asynchronous and never consumes the application's response. Authorization/cookie headers, bridge credentials, and MCP configuration/transport traffic are masked or excluded. Clearing/disabling capture removes buffered records; no logs are written to disk.

## Troubleshooting and checks

If disconnected, start the server, confirm both activation switches, and choose Reconnect. Reconnect rereads the file, so a late server startup works on legacy Pengu without a League restart. An occupied port fails explicitly; edit the configuration or stop the conflicting service. An invalid file must be fixed directly before reconnecting. Restore a minimized League window before requesting a screenshot.

In the source checkout, run `npm ci`, `npm run build` and `npm test` in this package before running root tests. Tests are excluded from the release package. Root tests cover renderer/config/settings/deployment behavior; package tests cover HTTP, stdio, authentication, bridge failure modes, and export/platform behavior. CI checks both packages. Set `ELAINA_SKIP_DEPLOY=1` when building only the release ZIP without copying to the installed Pengu folder.
