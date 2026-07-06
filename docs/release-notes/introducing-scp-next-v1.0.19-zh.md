# scp-next v1.0.19 项目介绍: 面向 Node.js 开发者的 SSH 文件传输工具

![scp-next](http://blog.mazey.net/wp-content/uploads/2026/07/scp-next-SF-s7x3.jpg)

介绍 scp-next v1.0.19 的 npm 安装、CLI 上传下载、配置文件、凭据安全、库 API 和新人接手流程。

- [前言](#前言)
- [适合谁使用](#适合谁使用)
- [安装方式](#安装方式)
- [先理解传输方向](#先理解传输方向)
- [命令行快速开始](#命令行快速开始)
- [推荐的凭据写法](#推荐的凭据写法)
- [常用命令选项](#常用命令选项)
- [配置文件用法](#配置文件用法)
- [库 API 用法](#库-api-用法)
- [主机验证](#主机验证)
- [新人接手清单](#新人接手清单)

## 前言

`scp-next` 是一个 SCP 风格的 npm 包。他同时提供命令行工具和库，用于通过 SSH 安全传输文件。虽然包名包含 SCP，实际使用 SFTP，不会为普通传输执行远程 Shell 命令。

## 适合谁使用

如果你需要在部署脚本、CI 流程或 Node.js 应用中传输文件，`scp-next` 可以减少重复封装。常见场景如下:

- 将本地构建产物上传到服务器。
- 从服务器下载日志或产物。
- 用配置文件管理不同服务器环境。
- 在应用代码中复用同一个传输客户端。

## 安装方式

全局安装后，可以直接使用 `scp-next` 命令。

```bash
npm install --global scp-next
```

作为项目依赖安装后，可以在 Node.js 代码中导入 API。

```bash
npm install scp-next
```

如果一个项目只在脚本里调用命令行工具，也可以把他安装到项目依赖中，再通过 `npx scp-next` 或 npm scripts 调用。

## 先理解传输方向

命令行统一使用 `<source> <destination>` 两个位置参数。

```text
scp-next upload <source> <destination> [options]
scp-next download <source> <destination> [options]
scp-next run <job> [source] [destination] [options]
```

方向规则如下:

| Operation | Source | Destination |
| --------- | ------ | ----------- |
| Upload    | Local  | Remote      |
| Download  | Remote | Local       |

## 命令行快速开始

上传本地目录到远程服务器。

```bash
scp-next upload ./dist /var/www/example \
  --host your-host \
  --username your-username \
  --password your-password \
  --recursive
```

下载远程文件到本地目录。如果目标目录不存在，`scp-next` 默认会创建目录。这符合日常 `cp` 和 `scp` 风格的使用习惯。可以用 `--no-create-directories` 关闭该行为。

```bash
scp-next download /var/log/example.log ./logs/example.log \
  --host your-host \
  --username your-username \
  --password your-password
```

先预览上传计划，而不连接服务器。`--dry-run` 会解析配置并检查本地路径。他不会连接远程服务器，也不会修改本地或远程文件。

```bash
scp-next upload ./dist /var/www/example \
  --host your-host \
  --username your-username \
  --password your-password \
  --recursive \
  --dry-run
```

## 推荐的凭据写法

命令行密码参数适合本地快速试用。

```bash
scp-next upload ./dist /var/www/example \
  --host your-host \
  --username your-username \
  --password your-password \
  --recursive
```

共享环境和生产环境建议使用环境变量。这样可以降低密码进入 Shell 历史记录或进程列表的风险。

```bash
export SCP_NEXT_HOST="your-host"
export SCP_NEXT_USERNAME="your-username"
export SCP_NEXT_PASSWORD="your-password"

scp-next upload ./dist /var/www/example --recursive
```

也可以使用受保护的私钥文件。

```bash
scp-next upload ./dist /var/www/example \
  --host your-host \
  --username your-username \
  --private-key-file ~/.ssh/id_ed25519 \
  --recursive
```

## 常用命令选项

| 选项                                  | 作用                            |
| ------------------------------------- | ------------------------------- |
| `--host <host>`                       | SSH 服务器地址。                |
| `--port <port>`                       | SSH 服务器端口，默认值为 `22`。 |
| `--username <username>`               | SSH 用户名。                    |
| `--password <password>`               | SSH 密码。                      |
| `--private-key-file <privateKeyFile>` | 私钥文件路径，支持 `~`。        |
| `--passphrase <passphrase>`           | 加密私钥的口令。                |
| `--config <path>`                     | 指定配置文件路径。              |
| `--profile <name>`                    | 选择配置文件中的服务器配置。    |
| `--recursive`                         | 递归传输目录，默认关闭。        |
| `--overwrite`                         | 允许覆盖已有目标文件。          |
| `--create-directories`                | 创建缺失的目标目录，默认开启。  |
| `--no-create-directories`             | 关闭目标目录自动创建。          |
| `--dry-run`                           | 只解析和验证，不执行传输。      |
| `--timeout <milliseconds>`            | SSH 握手超时时间，单位为毫秒。  |
| `--quiet`                             | 关闭进度和非错误输出。          |
| `--verbose`                           | 输出不含敏感信息的诊断内容。    |

## 配置文件用法

CLI 会自动查找以下配置文件。

```text
scp-next.config.json
.scp-nextrc
.scp-nextrc.json
```

也可以显式指定路径。

```bash
scp-next upload ./dist /var/www/example \
  --config ./scp-next.config.json \
  --profile production
```

下面是一个包含服务器配置和任务的示例。

```json
{
  "profiles": {
    "production": {
      "host": "your-host",
      "username": "your-username",
      "privateKeyFile": "~/.ssh/id_ed25519"
    }
  },
  "jobs": {
    "deploy": {
      "operation": "upload",
      "profile": "production",
      "source": "./dist",
      "destination": "/var/www/example",
      "recursive": true,
      "overwrite": true
    },
    "download-logs": {
      "operation": "download",
      "profile": "production",
      "source": "/var/log/example",
      "destination": "./logs",
      "recursive": true
    }
  }
}
```

运行配置好的上传任务。

```bash
scp-next run deploy
```

运行配置好的下载任务。

```bash
scp-next run download-logs
```

`run` 命令也支持临时覆盖路径。

```bash
scp-next run deploy ./dist-canary /var/www/canary
```

配置优先级从高到低如下。

1. 显式 CLI 选项
2. 位置参数
3. 环境变量
4. 选中的配置 profile
5. 根级配置值
6. 配置的 job 值
7. 内部默认值

不要把包含真实密码的配置文件提交到 Public 仓库。共享仓库和部署环境应优先使用 `SCP_NEXT_PASSWORD` 或受保护的密钥文件。

## 库 API 用法

ESM 项目可以直接导入 `upload`。

```ts
import { upload } from "scp-next";

await upload({
  host: process.env.SCP_NEXT_HOST,
  username: process.env.SCP_NEXT_USERNAME,
  password: process.env.SCP_NEXT_PASSWORD,
  localPath: "./dist",
  remotePath: "/var/www/example",
  recursive: true,
  overwrite: true
});
```

CommonJS 项目可以使用 `require`。

```js
const { download } = require("scp-next");

async function main() {
  await download({
    host: process.env.SCP_NEXT_HOST,
    username: process.env.SCP_NEXT_USERNAME,
    password: process.env.SCP_NEXT_PASSWORD,
    remotePath: "/var/log/example.log",
    localPath: "./logs/example.log"
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
```

如果一次连接内要执行多个操作，可以创建可复用客户端。

```ts
import { createClient } from "scp-next";

const client = createClient({
  host: process.env.SCP_NEXT_HOST,
  username: process.env.SCP_NEXT_USERNAME,
  password: process.env.SCP_NEXT_PASSWORD
});

try {
  await client.connect();
  await client.upload("./dist", "/var/www/example", { recursive: true });
  await client.download("/var/log/example.log", "./logs/example.log");
} finally {
  await client.close();
}
```

主要导出如下。

```ts
upload(options);
download(options);
createClient(options);
copy(options);
```

错误类型包含稳定的 `code`、可读的 `message` 和经过脱敏的上下文。常见错误包括 `ConfigurationError`、`AuthenticationError`、`ConnectionError`、`TransferError` 和 `HostVerificationError`。

## 主机验证

`scp-next` 支持通过 `hostFingerprint` 或 `knownHostsFile` 验证主机。如果没有显式配置，他会读取 `~/.ssh/known_hosts`。

在 CI 或部署环境中，如果没有可用的 known-hosts 文件，建议配置 `hostFingerprint`。如果无法建立主机验证，`scp-next` 会失败退出。

## 新人接手清单

接手项目时，可以按以下顺序验证。

1. 确认 Node.js 版本不低于 18.18.0。
2. 使用 `npm install --global scp-next` 安装 CLI。
3. 用 `scp-next upload ... --dry-run` 验证参数和路径。

掌握这几项后，就可以把 `scp-next` 用于日常部署脚本、日志下载任务和 Node.js 文件传输流程。

**版权声明**

本文为原创文章，作者保留版权。转载请保留本文完整内容，并以超链接形式注明作者及原文出处。

作者: [除除](https://github.com/chengchuu)
原文: <https://blog.mazey.net/6454.html>

<!-- ID: introducing-scp-next-v1.0.19-zh -->

(完)
