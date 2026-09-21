import React from 'react';
import Editor from '@monaco-editor/react';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { getCompletionsForPosition } from './intellisense';
import { AppTheme } from '../theme';

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

export const SQL_LIGHT_THEME_NAME = 'sql-light';

export const SQL_LIGHT_THEME_DATA = {
  base: 'vs' as const,
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#FFFFFF',
    'editor.foreground': '#18212A',
    'editor.lineHighlightBackground': '#EBF0F5',
    'editorCursor.foreground': '#186C74',
  },
};

export const SQL_NOIR_THEME_NAME = 'sql-noir';

export const SQL_NOIR_THEME_DATA = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#050608',
    'editor.foreground': '#EEF0F2',
    'editor.lineHighlightBackground': '#0C0E12',
    'editorCursor.foreground': '#E1B85C',
  },
};

export const SQL_OCEAN_THEME_NAME = 'sql-ocean';

export const SQL_OCEAN_THEME_DATA = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#07111D',
    'editor.foreground': '#E1F0FF',
    'editor.lineHighlightBackground': '#0E263E',
    'editorCursor.foreground': '#4BB0E6',
  },
};

export const defineSqlDarkTheme = (monaco: any) => {
  if (monaco?.editor?.defineTheme) {
    monaco.editor.defineTheme(SQL_DARK_THEME_NAME, SQL_DARK_THEME_DATA);
  }
};

export const defineSqlLightTheme = (monaco: any) => {
  if (monaco?.editor?.defineTheme) {
    monaco.editor.defineTheme(SQL_LIGHT_THEME_NAME, SQL_LIGHT_THEME_DATA);
  }
};

export const defineSqlNoirTheme = (monaco: any) => {
  if (monaco?.editor?.defineTheme) {
    monaco.editor.defineTheme(SQL_NOIR_THEME_NAME, SQL_NOIR_THEME_DATA);
  }
};

export const defineSqlOceanTheme = (monaco: any) => {
  if (monaco?.editor?.defineTheme) {
    monaco.editor.defineTheme(SQL_OCEAN_THEME_NAME, SQL_OCEAN_THEME_DATA);
  }
};

export interface SqlEditorProps {
  theme?: AppTheme;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({ theme = 'midnight' }) => {
  const { sql, setSql, runQuery } = useWorkspaceStore();
  const monacoTheme =
    theme === 'light'
      ? SQL_LIGHT_THEME_NAME
      : theme === 'noir'
        ? SQL_NOIR_THEME_NAME
        : theme === 'ocean'
          ? SQL_OCEAN_THEME_NAME
          : SQL_DARK_THEME_NAME;

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
          theme={monacoTheme}
          value={sql}
          onChange={handleEditorChange}
          beforeMount={(monaco) => {
            defineSqlDarkTheme(monaco);
            defineSqlLightTheme(monaco);
            defineSqlNoirTheme(monaco);
            defineSqlOceanTheme(monaco);
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
            defineSqlLightTheme(monaco);
            defineSqlNoirTheme(monaco);
            defineSqlOceanTheme(monaco);

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
