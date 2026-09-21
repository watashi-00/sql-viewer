import React from 'react';
import Editor from '@monaco-editor/react';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { getCompletionsForPosition } from './intellisense';

let completionProviderRegistered = false;

export const SQL_DARK_THEME_NAME = 'sql-dark';

export const SQL_DARK_THEME_DATA = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#0B0D10',
    'editor.lineHighlightBackground': '#111418',
    'editorCursor.foreground': '#7C9CFF',
  },
};

export const defineSqlDarkTheme = (monaco: any) => {
  if (monaco?.editor?.defineTheme) {
    monaco.editor.defineTheme(SQL_DARK_THEME_NAME, SQL_DARK_THEME_DATA);
  }
};

export const SqlEditor: React.FC = () => {
  const { sql, setSql, runQuery } = useWorkspaceStore();

  const handleEditorChange = (value?: string) => {
    if (value !== undefined) {
      setSql(value);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-surface border-b border-border">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-secondary border-b border-border text-xs text-secondary font-mono">
        <span>SQL EDITOR</span>
        <span className="text-muted">Press F5 or click Run to execute</span>
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          defaultLanguage="sql"
          theme={SQL_DARK_THEME_NAME}
          value={sql}
          onChange={handleEditorChange}
          beforeMount={(monaco) => {
            defineSqlDarkTheme(monaco);
          }}
          options={{
            fontSize: 13,
            fontFamily: 'JetBrains Mono, monospace',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            padding: { top: 8, bottom: 8 },
          }}
          onMount={(editor, monaco) => {
            defineSqlDarkTheme(monaco);

            editor.addCommand(monaco.KeyCode.F5, () => {
              runQuery();
            });

            if (!completionProviderRegistered && monaco?.languages?.registerCompletionItemProvider) {
              completionProviderRegistered = true;
              monaco.languages.registerCompletionItemProvider('sql', {
                triggerCharacters: [' ', '.', '('],
                provideCompletionItems: (model: any, position: any) => {
                  const wordInfo = model.getWordUntilPosition(position);
                  const lineContent = model.getLineContent ? model.getLineContent(position.lineNumber) : '';
                  const textBefore = lineContent ? lineContent.substring(0, wordInfo.startColumn - 1) : '';
                  const dotMatch = textBefore.match(/([a-zA-Z0-9_]+)\.$/);
                  const searchWord = dotMatch ? `${dotMatch[1]}.${wordInfo.word}` : wordInfo.word;

                  const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: wordInfo.startColumn,
                    endColumn: wordInfo.endColumn,
                  };
                  const schema = useWorkspaceStore.getState().schema;
                  const currentSql = model.getValue();
                  const completions = getCompletionsForPosition(currentSql, searchWord, schema);

                  return {
                    suggestions: completions.map((item) => ({
                      ...item,
                      range,
                    })),
                  };
                },
              });
            }
          }}
        />
      </div>
    </div>
  );
};
