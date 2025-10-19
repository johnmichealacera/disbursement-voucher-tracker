"use client"

import { useEffect, useState } from 'react'

interface PerformanceMetrics {
  loadTime: number
  renderTime: number
  apiResponseTime: number
  memoryUsage: number
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') return

    const startTime = performance.now()
    
    // Monitor page load time
    const measureLoadTime = () => {
      const loadTime = performance.now() - startTime
      
      // Monitor memory usage (if available)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0
      
      setMetrics({
        loadTime: Math.round(loadTime),
        renderTime: 0, // Will be updated by individual components
        apiResponseTime: 0, // Will be updated by API calls
        memoryUsage: Math.round(memoryUsage / 1024 / 1024) // Convert to MB
      })
    }

    // Measure after initial render
    setTimeout(measureLoadTime, 100)

    // Listen for keyboard shortcut to toggle visibility
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [])

  if (!isVisible || !metrics) return null

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-3 rounded-lg text-xs font-mono z-50">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold">Performance</span>
        <button 
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>
      <div className="space-y-1">
        <div>Load: {metrics.loadTime}ms</div>
        <div>Render: {metrics.renderTime}ms</div>
        <div>API: {metrics.apiResponseTime}ms</div>
        <div>Memory: {metrics.memoryUsage}MB</div>
      </div>
      <div className="text-gray-400 mt-2 text-xs">
        Press Ctrl+Shift+P to toggle
      </div>
    </div>
  )
}

// Hook to measure component render time
export function useRenderTime(componentName: string) {
  useEffect(() => {
    const startTime = performance.now()
    
    return () => {
      const renderTime = performance.now() - startTime
      console.log(`${componentName} render time: ${Math.round(renderTime)}ms`)
    }
  }, [componentName])
}

// Hook to measure API response time
// export function useApiTiming() {
//   const measureApiCall = async <T>(
//     apiCall: () => Promise<T>,
//     endpoint: string
//   ): Promise<T> => {
//     const startTime = performance.now()
//     try {
//       const result = await apiCall()
//       const responseTime = performance.now() - startTime
//       console.log(`${endpoint} API response time: ${Math.round(responseTime)}ms`)
//       return result
//     } catch (error) {
//       const responseTime = performance.now() - startTime
//       console.log(`${endpoint} API error time: ${Math.round(responseTime)}ms`)
//       throw error
//     }
//   }

//   return { measureApiCall }
// }
