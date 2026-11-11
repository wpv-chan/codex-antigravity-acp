import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { Readable, Writable } from 'node:stream'
import { ClientApp, ndJsonStream } from '@agentclientprotocol/sdk'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

// The registered command supplies the absolute path to Google's installed CLI.
const agy = process.argv[2]
if (!agy) throw new Error('The path to the Google Antigravity CLI (agy.exe) is required.')
const workspace = join(import.meta.dirname, 'workspace')
const sessions = join(import.meta.dirname, 'sessions')
const shutdown = new AbortController()
const targetModel = 'gemini-4-carbon'
const targetEffort = 'high'

// A Windows named pipe gives the same discussion one writer across Codex processes.
// The OS releases it even if the process is interrupted. It carries no data.
async function lockDiscussion(id) {
  const lock = createServer(socket => socket.destroy())
  const pipe = '\\\\.\\pipe\\codex-antigravity-' + id
  await new Promise((resolve, reject) => {
    lock.once('error', err => {
      reject(err.code === 'EADDRINUSE' ? new Error('This Gemini discussion already has a turn in progress.') : err)
    })
    lock.listen(pipe, resolve)
  })
  return lock
}

function valueOf(options, id) {
  return options?.find(option => option.id === id)?.currentValue
}

async function selectModel(agent, sessionId, options) {
  for (const [configId, value] of [['model', targetModel], ['thought_level', targetEffort]]) {
    if (valueOf(options, configId) !== value) {
      const result = await agent.request('session/set_config_option', { sessionId, configId, value })
      options = result.configOptions
    }
  }
  if (valueOf(options, 'model') !== targetModel || valueOf(options, 'thought_level') !== targetEffort) {
    throw new Error('Antigravity could not confirm Gemini 4 Carbon with High thinking for this session.')
  }
}

async function askGemini(question, file, resume, signal) {
  const previous = resume ? await readFile(file, 'utf8').catch(err => {
    if (err.code === 'ENOENT') throw new Error('Unknown discussion_id. Use the ID returned by an earlier discuss call.')
    throw err
  }) : undefined
  signal.throwIfAborted()
  const cli = spawn(agy, ['acp', '--agent', 'codex-discussion', '--include-default-customizations=false'], {
    cwd: workspace, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore']
  })
  const exited = new Promise(resolve => cli.once('close', resolve))
  let activeSession
  let receiving = false
  const chunks = []
  const app = new ClientApp({ name: 'Codex discussion' })
  app.onRequest('session/request_permission', () => ({ outcome: { outcome: 'cancelled' } }))
  app.onNotification('session/update', ({ params: { sessionId, update } }) => {
    if (receiving && sessionId === activeSession && update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
      chunks.push(update.content.text)
    }
  })
  const stream = ndJsonStream(Writable.toWeb(cli.stdin), Readable.toWeb(cli.stdout))
  const connection = app.connect(stream)
  const { agent } = connection
  cli.once('error', error => connection.close(error))
  cli.stdin.on('error', error => connection.close(error))
  const abort = () => {
    if (activeSession) agent.notify('session/cancel', { sessionId: activeSession }).catch(() => {})
    connection.close(signal.reason)
    cli.kill()
  }
  signal.addEventListener('abort', abort, { once: true })
  try {
    const hello = await agent.request('initialize', {
      protocolVersion: 1, clientInfo: { name: 'codex-antigravity-discussion', version: '1.0.0' }, clientCapabilities: {}
    })
    if (hello.protocolVersion !== 1) throw new Error('Antigravity did not negotiate ACP v1.')
    const params = { cwd: workspace, mcpServers: [] }
    const session = resume
      ? await agent.request('session/resume', { ...params, sessionId: previous })
      : await agent.request('session/new', params)
    activeSession = previous ?? session.sessionId
    await selectModel(agent, activeSession, session.configOptions)
    if (!resume) await writeFile(file, activeSession, { flag: 'wx', mode: 0o600 })

    receiving = true
    const result = await agent.request('session/prompt', {
      sessionId: activeSession, prompt: [{ type: 'text', text: question }]
    })
    receiving = false
    signal.throwIfAborted()
    const reply = chunks.join('').trim()
    if (result.stopReason !== 'end_turn') {
      throw new Error('Antigravity stopped with ' + result.stopReason + (reply ? '\n' + reply : ''))
    }
    if (!reply) throw new Error('Antigravity ended the turn without returning a text reply.')
    return reply
  } finally {
    receiving = false
    signal.removeEventListener('abort', abort)
    cli.stdin.end()
    const forceExit = setTimeout(() => cli.kill(), 3000)
    forceExit.unref()
    try { await exited } finally {
      clearTimeout(forceExit)
      connection.close()
    }
  }
}

const server = new McpServer({ name: 'antigravity', version: '1.0.0' })
server.registerTool('discuss', {
  title: 'Discuss with Gemini 4 Carbon High',
  description: 'Ask Google Antigravity (Gemini 4 Carbon, High thinking) for an independent opinion or follow-up. Use when the user wants Gemini in the discussion. Send the question and the relevant context. Reuse the returned discussion_id for the same topic. Attribute the reply to Gemini when reporting it.',
  inputSchema: {
    question: z.string().trim().min(1).describe('Question and any context to share with Gemini.'),
    discussion_id: z.uuid().optional().describe('ID from this tool. Omit to start a separate conversation.')
  },
  annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true }
}, async ({ question, discussion_id }, { signal }) => {
  const id = discussion_id ?? randomUUID()
  const file = join(sessions, id)
  let lock
  try {
    await mkdir(sessions, { recursive: true, mode: 0o700 })
    lock = await lockDiscussion(id)
    const deadline = AbortSignal.any([signal, shutdown.signal, AbortSignal.timeout(570_000)])
    const reply = await askGemini(question, file, Boolean(discussion_id), deadline)
    const result = { model: targetModel, thinking_level: targetEffort, discussion_id: id, reply }
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result }
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: 'Antigravity: ' + error.message }] }
  } finally {
    lock?.close()
  }
})

// If the Codex client disconnects, stop any in-flight Google request.
process.stdin.once('end', () => shutdown.abort(new Error('Codex disconnected.')))
process.once('SIGTERM', () => { shutdown.abort(); server.close().catch(() => {}) })
await server.connect(new StdioServerTransport())
