import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  title?: string
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center h-full text-gray-500 p-8">
          <div className="text-center">
            <p className="text-red-400 font-medium mb-1">This component encountered an error</p>
            <p className="text-gray-500 text-xs mb-3">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
