# `scp-next` v1.0.19: 面向 Node.js 开发者的 SSH 文件传输工具

![scp-next](http://blog.mazey.net/wp-content/uploads/2026/07/scp-next-SF-s7x3.jpg)

本文介绍 `scp-next` v1.0.19 的 npm 安装方式和 CLI 用法。内容还包括配置文件、凭据安全、库 API 和新成员接手流程。

```plain
英文标签:
#ScpNext #Nodejs #TypeScript #SFTP #SSH #FileTransfer #CommandLine #DeveloperTools #NpmPackage #DevOps
中文标签:
#文件传输 #命令行工具 #开发者工具 #自动化部署 #服务器运维 #配置管理 #密钥认证 #后端开发 #工程实践 #技术分享
```

- [项目概述](#项目概述)
- [适用场景](#适用场景)
- [安装方式](#安装方式)
- [传输方向](#传输方向)
- [命令行快速开始](#命令行快速开始)
- [凭据配置建议](#凭据配置建议)
- [常用命令选项](#常用命令选项)
- [配置文件](#配置文件)
- [库 API](#库-api)
- [主机验证](#主机验证)
- [项目接手清单](#项目接手清单)

## 项目概述

`scp-next` 是一个 SCP 风格的 npm 包。他同时提供命令行工具和库，用于通过 SSH 安全传输文件。虽然包名包含 SCP，但普通传输使用 SFTP。

## 适用场景

部署脚本、CI 流程和 Node.js 应用都可以使用 `scp-next` 传输文件。这样能减少重复封装。常见场景如下:

- 将本地构建产物上传到服务器。
- 从服务器下载日志或产物。
- 用配置文件管理不同服务器环境。
- 在应用代码中复用同一个传输客户端。

`scp-next` 要求 Node.js 版本不低于 18.18.0。

## 安装方式

全局安装后，可以直接使用 `scp-next` 命令。

```bash
npm install --global scp-next
```

作为项目依赖安装后，可以在 Node.js 代码中导入 API。

```bash
npm install scp-next
```

如果项目只需要在脚本中调用 CLI，可以将 `scp-next` 安装为项目依赖。安装后，可通过 `npx scp-next` 或 npm scripts 调用命令。

## 传输方向

命令行统一使用 `<source> <destination>` 两个位置参数。

```plain
scp-next upload <source> <destination> [options]
scp-next download <source> <destination> [options]
scp-next run <job> [source] [destination] [options]
```

方向规则如下:

| Operation | Source | Destination |
| :-------- | :----- | :---------- |
| Upload    | Local  | Remote      |
| Download  | Remote | Local       |

库 API 不使用 `<source>` 和 `<destination>`。上传和下载选项使用 `localPath` 与 `remotePath`。这两个名称可在应用代码中明确区分本地路径和远程路径。

## 命令行快速开始

上传本地目录到远程服务器。

```bash
scp-next upload ./dist /var/www/example \
  --host your-host \
  --username your-username \
  --password your-password \
  --recursive
```

将远程文件下载到本地路径。如果目标目录不存在，`scp-next` 默认会创建该目录。这符合日常使用 `cp` 和 `scp` 时的习惯。可以用 `--no-create-directories` 关闭该行为。

```bash
scp-next download /var/log/example.log ./logs/example.log \
  --host your-host \
  --username your-username \
  --password your-password
```

可以先预览上传计划，而不连接服务器。`--dry-run` 会解析配置并检查本地路径。该选项不会连接远程服务器，也不会修改本地或远程文件。

```bash
scp-next upload ./dist /var/www/example \
  --host your-host \
  --username your-username \
  --password your-password \
  --recursive \
  --dry-run
```

## 凭据配置建议

命令行密码参数便于本地快速试用。密码可能出现在 shell 历史记录或进程列表中。

```bash
scp-next upload ./dist /var/www/example \
  --host your-host \
  --username your-username \
  --password your-password \
  --recursive
```

共享环境和生产环境建议使用环境变量。这样可以降低密码进入 shell 历史记录或进程列表的风险。

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

如果环境已经使用 SSH agent 身份验证，可以先添加密钥。`scp-next` 随后会使用 `SSH_AUTH_SOCK`。

```bash
ssh-add ~/.ssh/id_ed25519

export SCP_NEXT_HOST="your-host"
export SCP_NEXT_USERNAME="your-username"

scp-next upload ./dist /var/www/example --recursive
```

## 常用命令选项

| 选项                                  | 作用                               |
| :------------------------------------ | :--------------------------------- |
| `--host <host>`                       | SSH 服务器地址。                   |
| `--port <port>`                       | SSH 服务器端口，默认值为 `22`。    |
| `--username <username>`               | SSH 用户名。                       |
| `--password <password>`               | SSH 密码。                         |
| `--private-key-file <privateKeyFile>` | 私钥文件路径，支持 `~`。           |
| `--passphrase <passphrase>`           | 加密私钥的口令。                   |
| `--config <path>`                     | 指定配置文件路径。                 |
| `--profile <name>`                    | 选择配置文件中的服务器配置。       |
| `--recursive`                         | 递归传输目录，默认关闭。           |
| `--overwrite`                         | 允许覆盖已有目标文件。             |
| `--create-directories`                | 创建缺失的目标目录，默认开启。     |
| `--no-create-directories`             | 关闭目标目录自动创建。             |
| `--dry-run`                           | 只解析和验证，不执行传输。         |
| `--timeout <milliseconds>`            | SSH 连接就绪超时时间，单位为毫秒。 |
| `--quiet`                             | 关闭进度和非错误输出。             |
| `--verbose`                           | 输出不含敏感信息的诊断内容。       |

`--timeout` 映射到 SSH 的 `readyTimeout`。`--timeout` 控制等待连接握手完成的时长。`--timeout` 不限制单个文件或整个传输任务的执行时长。

## 配置文件

CLI 会自动查找以下配置文件。

```plain
scp-next.config.json
.scp-nextrc
.scp-nextrc.json
```

也可以通过 `--config` 显式指定路径。

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

运行已配置的上传任务。

```bash
scp-next run deploy
```

运行已配置的下载任务。

```bash
scp-next run download-logs
```

`run` 命令也支持临时覆盖路径。

```bash
scp-next run deploy ./dist-canary /var/www/canary
```

配置优先级从高到低如下:

1. 显式 CLI 选项
2. 位置参数
3. 环境变量
4. 所选 `profile`
5. 根级别配置值
6. `job` 配置值
7. 内部默认值

不要将包含真实密码的配置文件提交到公共仓库。共享仓库和部署环境应优先使用 `SCP_NEXT_PASSWORD`。也可以使用 SSH agent 身份验证或受保护的密钥文件。

## 库 API

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

如果需要在同一个连接生命周期内执行多个操作，可以创建可复用客户端。

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

公共错误包含稳定的 `code`、可读的 `message` 和可选的 `cause`。`scp-next` 会对错误上下文进行脱敏处理。处理后的上下文不包含敏感信息。常见错误类型包括 `ConfigurationError`、`AuthenticationError` 和 `ConnectionError`。其他类型包括 `TransferError` 和 `HostVerificationError`。

## 主机验证

`scp-next` 支持两种主机验证配置: `hostFingerprint` 和 `knownHostsFile`。如果没有显式配置，程序会读取 `~/.ssh/known_hosts`。

在 CI 或部署环境中，可能没有可用的 `known_hosts` 文件。此时建议配置 `hostFingerprint`。如果无法建立主机验证，`scp-next` 会拒绝继续执行。

## 项目接手清单

接手已经使用 `scp-next` 的项目时，可以按以下顺序验证。

1. 确认 Node.js 版本不低于 18.18.0。
2. 使用 `npm install --global scp-next` 安装 CLI。
3. 用 `scp-next upload ... --dry-run` 验证参数和路径。
4. 通过环境变量或配置文件管理服务器连接信息。
5. 使用 `scp-next run <job>` 处理重复执行的上传或下载流程。
6. 如果项目需要集成库，可在 Node.js 代码中使用 `upload`、`download` 或 `createClient`。

完成这些步骤后，即可使用 `scp-next`。他适用于部署脚本、日志下载任务和 Node.js 文件传输流程。

**版权声明**

本文为原创文章，作者保留版权。转载请保留全文，并通过超链接注明作者和原文出处。

作者: [除除](https://github.com/chengchuu)
原文: <https://blog.mazey.net/6454.html>

<!-- ID: introducing-scp-next-v1.0.19.zh-CN.md -->
