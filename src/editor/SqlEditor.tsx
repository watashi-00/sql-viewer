import React, { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { getCompletionsForPosition } from './intellisense';
import { AppTheme } from '../theme';
import { AlertTriangle } from 'lucide-react';
import { createMonacoMarkers } from './monacoDiagnostics';

const DIAGNOSTIC_MARKER_OWNER = 'sql-viewer-diagnostics';

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
  const { sql, setSql, runQuery, queryError, lastExecutionMode } = useWorkspaceStore();
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
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

  useEffect(() => {
    const model = editorRef.current?.getModel?.();
    const monaco = monacoRef.current;
    if (!model || !monaco?.editor?.setModelMarkers) return;
    monaco.editor.setModelMarkers(model, DIAGNOSTIC_MARKER_OWNER, createMonacoMarkers(queryError));
  }, [queryError]);

  return (
    <div className="h-full w-full flex flex-col bg-surface border-b border-border">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-secondary border-b border-border text-xs text-secondary font-mono">
        <span>SQL EDITOR</span>
        <span className={lastExecutionMode === 'selection' ? 'text-accent' : 'text-muted'}>
          {lastExecutionMode === 'selection' ? 'Selected SQL executed' : 'Ctrl+Enter runs selection · F5 runs query'}
        </span>
      </div>
      {queryError && (
        <div role="alert" className="max-h-32 shrink-0 overflow-y-auto border-b border-error/30 bg-error/5 px-3 py-2 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-error" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 font-semibold text-error">
                <span>{queryError.title}</span>
                {queryError.line && (
                  <span className="font-normal text-muted">Line {queryError.line}{queryError.column ? `, column ${queryError.column}` : ''}</span>
                )}
              </div>
              <p className="mt-1 text-primary">{queryError.message}</p>
              {queryError.suggestion && <p className="mt-1 text-secondary">{queryError.suggestion}</p>}
              <details className="mt-1 text-muted">
                <summary className="cursor-pointer select-text">Technical details</summary>
                <pre className="mt-1 whitespace-pre-wrap break-words font-mono">{queryError.technicalMessage}</pre>
              </details>
            </div>
          </div>
        </div>
      )}
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
            editorRef.current = editor;
            monacoRef.current = monaco;
            defineSqlDarkTheme(monaco);
            defineSqlLightTheme(monaco);
            defineSqlNoirTheme(monaco);
            defineSqlOceanTheme(monaco);
            if (editor.getModel?.() && monaco?.editor?.setModelMarkers) {
              monaco.editor.setModelMarkers(editor.getModel(), DIAGNOSTIC_MARKER_OWNER, createMonacoMarkers(queryError));
            }

            if (monaco?.KeyMod?.CtrlCmd !== undefined && monaco?.KeyCode?.Enter !== undefined) {
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
                const selection = editor.getSelection?.();
                const model = editor.getModel?.();
                const selectedSql = selection && !selection.isEmpty?.()
                  ? model?.getValueInRange?.(selection)
                  : undefined;
                if (!selection || !selectedSql?.trim()) {
                  void runQuery();
                  return;
                }
                void runQuery(selectedSql, {
                  line: selection.startLineNumber,
                  column: selection.startColumn,
                });
              });
            }

            editor.addCommand(monaco.KeyCode.F5, () => {
              void runQuery();
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
