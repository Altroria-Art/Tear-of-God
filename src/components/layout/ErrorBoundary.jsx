import { Component } from 'react';
import { withTranslation } from 'react-i18next';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { t } = this.props;
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
          <h1 className="text-2xl font-bold text-ink mb-4">{t('common.errorOccurred', 'Something went wrong')}</h1>
          <p className="text-muted mb-8 max-w-md">
            {this.state.error?.message || t('common.unknownError', 'An unknown error occurred.')}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-canvas border border-ink/10 rounded-md text-ink hover:bg-ink/5 transition-colors"
          >
            {t('common.retry', 'Retry')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default withTranslation()(ErrorBoundary);
