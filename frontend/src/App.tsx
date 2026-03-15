import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import './App.css'

function App() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<string[]>([])

  const handleSearch = async () => {
    try {
      const res = await invoke<string[]>('search', { query })
      setResults(res)
    } catch (error) {
      console.error('Search failed:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">SenseDesk</h1>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your files..."
          className="flex-1 p-2 border rounded"
        />
        <button onClick={handleSearch} className="px-4 py-2 bg-blue-500 text-white rounded">
          Search
        </button>
      </div>
      <div>
        {results.length === 0 ? (
          <p>No results yet.</p>
        ) : (
          <ul>
            {results.map((result, i) => (
              <li key={i}>{result}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default App
