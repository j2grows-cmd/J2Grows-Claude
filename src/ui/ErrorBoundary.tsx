// If something in the interface throws, the player sees a calm recovery screen instead of a blank page, with
// their save one click from safety (copy it, restore a backup, or reload).

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { exportText, restoreBackup } from '../store';
import { listBackups } from '../engine';
import { track } from '../telemetry';

interface Props {
  children: ReactNode;
  /** When set the boundary wraps one view only and offers to go back instead of showing the whole-app screen. */
  onReset?: () => void;
  label?: string;
}
interface St {
  error: Error | null;
  copied: boolean;
  backups: ReturnType<typeof listBackups>;
}

export class ErrorBoundary extends Component<Props, St> {
  state: St = { error: null, copied: false, backups: [] };

  static getDerivedStateFromError(error: Error): Partial<St> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    try {
      track('crash', { msg: String(error.message).slice(0, 200), where: (info.componentStack ?? '').split('\n').slice(0, 3).join(' | ').slice(0, 300) });
      this.setState({ backups: listBackups() });
    } catch {
      /* the recovery screen must never throw */
    }
  }

  copy = (): void => {
    let text = '';
    try {
      text = exportText();
    } catch {
      text = '';
    }
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => this.setState({ copied: true }), () => undefined);
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    const view = !!this.props.onReset;
    return (
      <div className="crash" role="alert">
        <h2>{view ? `${this.props.label ?? 'This page'} hit a problem` : 'Something went wrong'}</h2>
        <p className="muted">
          Your game is safe: it is saved in this browser and a few older copies are kept as backups.
          {view ? ' You can go back and carry on.' : ' Reloading usually fixes it.'}
        </p>
        <pre className="crash-msg">{String(this.state.error.message).slice(0, 300)}</pre>
        <div className="row wrap" style={{ gap: 8 }}>
          {view ? (
            <button type="button" className="btn btn-primary" onClick={() => { this.setState({ error: null }); this.props.onReset?.(); }}>Back to overview</button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => location.reload()}>Reload the game</button>
          )}
          <button type="button" className="btn" onClick={this.copy}>{this.state.copied ? 'Copied' : 'Copy my save'}</button>
          {this.state.backups.map((b) => (
            <button key={b.slot} type="button" className="btn btn-ghost" onClick={() => { if (restoreBackup(b.slot)) location.reload(); }}>
              Restore backup {b.slot} ({new Date(b.savedAt).toLocaleString()})
            </button>
          ))}
        </div>
      </div>
    );
  }
}
