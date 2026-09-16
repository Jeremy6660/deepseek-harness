/**
 * Launcher interface copy.
 *
 * These strings belong to the launcher's own interface. Product copy — title,
 * welcome, attribution, support — is not here: it is the publisher's, arrives
 * as inlined `DSH_CLIENT_*` values, and is read from `identity.ts`. Both
 * dictionaries are complete by type, so a new key cannot ship in one language
 * only.
 */

import type { LauncherLanguage } from './identity.ts'

/** Every message the launcher interface can print. */
export type MessageKey =
  | 'mode.portable'
  | 'mode.installed'
  | 'label.version'
  | 'label.commit'
  | 'label.mode'
  | 'label.stateRoot'
  | 'label.workspace'
  | 'label.integrity'
  | 'menu.prompt'
  | 'menu.run'
  | 'menu.guide'
  | 'menu.licenses'
  | 'menu.integrity'
  | 'menu.quit'
  | 'menu.invalid'
  | 'integrity.verified'
  | 'integrity.unsealed'
  | 'integrity.damaged'
  | 'integrity.unreadable'
  | 'integrity.issue'
  | 'launch.starting'
  | 'launch.ready'
  | 'launch.hint'
  | 'launch.exited'
  | 'launch.failed'
  | 'open.missing'
  | 'open.opened'
  | 'open.failed'
  | 'settings.ignored'
  | 'settings.schema'
  | 'settings.stateRootRejected'
  | 'stateRoot.empty'
  | 'stateRoot.filesystemRoot'
  | 'stateRoot.containsProgram'
  | 'stateRoot.insideProgram'
  | 'fatal'
  | 'wait.enter'
  | 'exit.bye'

/** One complete set of launcher messages. */
export type MessageDictionary = Readonly<Record<MessageKey, string>>

const ZH_CN: MessageDictionary = {
  'mode.portable': '免安装（使用本介质）',
  'mode.installed': '已安装到本机',
  'label.version': '版本',
  'label.commit': '上游修订',
  'label.mode': '运行方式',
  'label.stateRoot': '状态目录',
  'label.workspace': '工作目录',
  'label.integrity': '完整性',
  'menu.prompt': '请输入序号后回车：',
  'menu.run': '启动本地应用',
  'menu.guide': '打开中文使用指南',
  'menu.licenses': '查看许可与第三方声明',
  'menu.integrity': '重新检查发行完整性',
  'menu.quit': '退出',
  'menu.invalid': '无法识别该序号，请重新输入。',
  'integrity.verified': '已校验：全部文件与封存清单一致',
  'integrity.unsealed': '未封存：缺少 {names}，无法比对文件内容（开发用目录）',
  'integrity.damaged': '已损坏：{count} 个受管文件与封存清单不一致',
  'integrity.unreadable': '元数据无法读取：{detail}',
  'integrity.issue': '  {code}  {path}',
  'launch.starting': '正在启动本地应用：{executable}',
  'launch.ready': '应用已就绪：{url}',
  'launch.hint': '已在默认浏览器中打开。本窗口保持打开期间应用继续运行；按 Ctrl+C 或直接关闭本窗口即可结束。',
  'launch.exited': '应用已退出，退出码 {code}。',
  'launch.failed': '启动失败：{detail}',
  'open.missing': '本发行版未包含 {path}。',
  'open.opened': '已打开 {path}。',
  'open.failed': '无法打开 {path}：{detail}',
  'settings.ignored': '已忽略无法使用的启动器设置 {path}：{detail}',
  'settings.schema': '内容不符合本启动器支持的格式',
  'settings.stateRootRejected': '设置中的状态目录不可用（{reason}），已改用默认目录 {path}。',
  'stateRoot.empty': '目录为空',
  'stateRoot.filesystemRoot': '不能把整个磁盘作为状态目录',
  'stateRoot.containsProgram': '该目录包含程序文件本身',
  'stateRoot.insideProgram': '该目录位于程序文件内部，卸载或替换程序时会被一并删除',
  'fatal': '启动器无法继续：{detail}',
  'wait.enter': '按回车键返回菜单…',
  'exit.bye': '已退出。',
}

const EN: MessageDictionary = {
  'mode.portable': 'Portable (running from this medium)',
  'mode.installed': 'Installed on this computer',
  'label.version': 'Version',
  'label.commit': 'Upstream revision',
  'label.mode': 'Mode',
  'label.stateRoot': 'State directory',
  'label.workspace': 'Working directory',
  'label.integrity': 'Integrity',
  'menu.prompt': 'Enter a number and press Enter: ',
  'menu.run': 'Start the local application',
  'menu.guide': 'Open the Simplified Chinese guide',
  'menu.licenses': 'View licenses and third-party notices',
  'menu.integrity': 'Check distribution integrity again',
  'menu.quit': 'Quit',
  'menu.invalid': 'That is not one of the listed numbers. Try again.',
  'integrity.verified': 'Verified: every file matches the sealed manifest',
  'integrity.unsealed': 'Not sealed: {names} is missing, so file contents cannot be compared (development directory)',
  'integrity.damaged': 'Damaged: {count} managed file(s) differ from the sealed manifest',
  'integrity.unreadable': 'Metadata cannot be read: {detail}',
  'integrity.issue': '  {code}  {path}',
  'launch.starting': 'Starting the local application: {executable}',
  'launch.ready': 'The application is ready: {url}',
  'launch.hint': 'It has been opened in the default browser. The application runs while this window stays open; press Ctrl+C or close this window to end it.',
  'launch.exited': 'The application exited with code {code}.',
  'launch.failed': 'Could not start: {detail}',
  'open.missing': 'This distribution does not contain {path}.',
  'open.opened': 'Opened {path}.',
  'open.failed': 'Could not open {path}: {detail}',
  'settings.ignored': 'Ignored unusable launcher settings {path}: {detail}',
  'settings.schema': 'its content is not in the format this launcher supports',
  'settings.stateRootRejected': 'The configured state directory is unusable ({reason}); using the default directory {path} instead.',
  'stateRoot.empty': 'the directory is empty',
  'stateRoot.filesystemRoot': 'a whole disk cannot be the state directory',
  'stateRoot.containsProgram': 'that directory contains the program files themselves',
  'stateRoot.insideProgram': 'that directory is inside the program files, so removing or replacing the program would delete it too',
  'fatal': 'The launcher cannot continue: {detail}',
  'wait.enter': 'Press Enter to return to the menu…',
  'exit.bye': 'Goodbye.',
}

/**
 * Select one complete message set.
 * @param language - interface language chosen from the host locale.
 * @returns the dictionary for that language.
 */
export function launcherMessages(language: LauncherLanguage): MessageDictionary {
  return language === 'zh-CN' ? ZH_CN : EN
}

/**
 * Substitute placeholders in one message.
 * @param template - message text containing `{name}` placeholders.
 * @param values - replacement values by placeholder name.
 * @returns the message with every recognized placeholder replaced.
 */
export function format(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/gu, (whole, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : whole)
}
