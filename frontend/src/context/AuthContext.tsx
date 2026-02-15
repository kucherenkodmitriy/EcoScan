import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  email: string
  name: string
  role: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem('ecoscan_token')
    const storedUser = localStorage.getItem('ecoscan_user')
    const expiresAt = localStorage.getItem('ecoscan_expires')

    // Validate token expiry on initialization
    if (storedToken && storedUser) {
      if (expiresAt && new Date(expiresAt) <= new Date()) {
        // Token has expired — clear stored auth
        localStorage.removeItem('ecoscan_token')
        localStorage.removeItem('ecoscan_user')
        localStorage.removeItem('ecoscan_expires')
      } else {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Login failed')
    }

    const data = await response.json()
    localStorage.setItem('ecoscan_token', data.token)
    localStorage.setItem('ecoscan_user', JSON.stringify(data.user))
    localStorage.setItem('ecoscan_expires', data.expires_at)
    setToken(data.token)
    setUser(data.user)
  }

  const logout = () => {
    localStorage.removeItem('ecoscan_token')
    localStorage.removeItem('ecoscan_user')
    localStorage.removeItem('ecoscan_expires')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
