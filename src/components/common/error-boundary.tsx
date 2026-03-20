'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message,
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled UI error', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fatal-error">
          <h1>Something went wrong</h1>
          <p>{this.state.message}</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              this.setState({ hasError: false, message: '' });
              window.location.reload();
            }}
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
