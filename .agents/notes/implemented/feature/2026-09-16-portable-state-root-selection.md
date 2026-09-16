# Agent Note: Portable state-root selection

Status: implemented

English | [中文](2026-09-16-portable-state-root-selection.zh.md)

## Problem

The [portable launcher](../architecture/2026-09-13-portable-launcher-and-state-location.md) resolved the state directory from `PortableData/launcher.json` and presented the result in its header, but nothing in the interface could write that file. The value was reachable only by editing the file on the medium by hand.

Three parts of the choice were already built and had no caller: `resolveStateRoot` refused inadmissible placements, `writeLauncherSettings` persisted a value, and the bilingual dictionary carried four refusal reasons with no code path that could print them. The Simplified Chinese guide shipped in `Docs/zh-CN/` already described selecting the directory from the menu, so the delivered product documented an entry the menu did not offer.

## Decision

The menu gains a fifth entry, `5) Set the state directory`, between the integrity check and Quit. Selecting it prompts for one path, applies the choice, and prints one line.

`launcherSettingsPath()` owns where the choice is written per mode, and `applyStateRootChoice()` owns reading the stored settings, resolving the typed value, writing the accepted one, and computing the roots the next launch uses. It returns the settings path, the new roots, and the refusal when there was one — never a partially applied choice.

An empty line clears the stored choice, which returns both roots to the mode default. Any other value is resolved before it is stored: a refused value is reported and stored nowhere, because the settings file may only ever hold a choice the launcher can use. The value is stored with the spelling the user typed, so a relative path still names the same place when the medium mounts under another drive letter.

A refused value leaves the stored choice unchanged and the header keeps showing the roots the next launch will use. `STATE_ROOT_REASON` maps each `StateRootDefect` to its message key once, and both the startup path in `main.ts` and the menu entry report through it, so the same inadmissible directory is refused in the same words whether it was typed or read back from the file.

## Alternatives considered

**Print the settings file path and let the user edit it.** This is what the launcher did before, and it requires the buyer to know that a Harness home is, where the file is, and which placements the launcher refuses. A refused hand edit produces a fallback line on the next start with no indication of what to change.

**Accept any writable directory.** The three refusals exist because each one destroys or endangers user data: a volume root makes the product own a drive, a value containing the program puts the program inside the user's data, and a value inside the program directory is deleted by the uninstall. A writability check accepts all three.

**Store the resolved absolute path instead of the typed spelling.** The resolved path is what the launch uses, so storing it looks like removing a step. It breaks the one property the setting exists for: a medium that mounts as `E:` on one machine and `F:` on another would keep a path that no longer resolves, and the fallback would silently discard the user's choice.

**Re-prompt until the value is accepted.** A user who wants only to look at the current setting would have to satisfy the rules or end input to leave the entry. Reporting the refusal and returning to the menu keeps every entry escapable.

**Add a separate settings entry that also edits other launcher state.** The launcher stores exactly one choice. A settings surface for one field adds a level of navigation and an empty second field to the interface.

## Consequences

The menu now offers six entries, and `renderMenu` orders them; the entry sits fifth so `0) Quit` stays last and no earlier number changes meaning between builds.

The choice applies to the next launch. Changing it while an application is running does not move that application's state, which is why the confirmation names the settings file and says the change takes effect next launch rather than only naming the directory.

A stored value that no longer resolves still falls back to the mode default with the existing `settings.stateRootRejected` line, because the startup path is unchanged. The menu entry is the only writer, so the fallback now has a visible cause and a visible remedy in the same interface.

The launcher's write surface grows by one file it already owned and one directory it already created. It still starts no command the user can supply, and it still refuses a state root that would let an uninstall reach user data.
