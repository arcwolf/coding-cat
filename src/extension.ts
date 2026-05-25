import * as vscode from 'vscode';
import { CatPanel } from './catPanel';

export function activate(context: vscode.ExtensionContext) {
  console.log('Coding Cat is now active! 🐱');

  context.subscriptions.push(
    vscode.commands.registerCommand('coding-cat.start', () => {
      CatPanel.createOrShow(context);
    }),
    vscode.commands.registerCommand('coding-cat.stop', () => {
      CatPanel.kill();
    })
  );

  CatPanel.createOrShow(context);
}

export function deactivate() {
  CatPanel.kill();
}
