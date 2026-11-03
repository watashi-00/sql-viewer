import { SqlDiagnostic } from './sqlDiagnostics';

export interface MonacoSqlMarker {
  severity: number;
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export function createMonacoMarkers(diagnostic: SqlDiagnostic | null): MonacoSqlMarker[] {
  if (!diagnostic?.line) return [];
  const column = diagnostic.column ?? 1;
  return [{
    severity: 8, // monaco.MarkerSeverity.Error
    message: `${diagnostic.title}: ${diagnostic.message}`,
    startLineNumber: diagnostic.line,
    startColumn: column,
    endLineNumber: diagnostic.line,
    endColumn: column + 1,
  }];
}
