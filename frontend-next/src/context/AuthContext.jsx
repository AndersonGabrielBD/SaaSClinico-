'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import * as api from '@/lib/api'
import { useRouter } from 'next/navigation'

const AuthContext = createContext(undefined)

const TOKEN_KEY = 'token'
const USER_KEY = 'user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
      
      if (token) {
        setIsAuthenticated(true)
        
        // Carrega dados do localStorage
        const userData = typeof window !== 'undefined' ? localStorage.getItem(USER_KEY) : null
        if (userData) {
          setUser(JSON.parse(userData))
        }
        
        // Tenta carregar do backend para atualizar
        try {
          const response = await api.getCurrentUser()
          if (response && response.user) {
            setUser(response.user)
            if (typeof window !== 'undefined') {
              localStorage.setItem(USER_KEY, JSON.stringify(response.user))
            }
          }
        } catch (error) {
          console.error('Erro ao carregar usuário:', error)
          // Se falhar, remove o token inválido
          if (typeof window !== 'undefined') {
            localStorage.removeItem(TOKEN_KEY)
            localStorage.removeItem(USER_KEY)
          }
          setIsAuthenticated(false)
          setUser(null)
        }
      } else {
        setIsAuthenticated(false)
        setUser(null)
      }
    } catch (error) {
      console.error('Erro ao verificar sessão:', error)
      setIsAuthenticated(false)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email, password) => {
    try {
      setLoading(true)
      
      const response = await api.login(email, password)

      if (response && response.token && response.user) {
        // Armazenar token e usuário
        if (typeof window !== 'undefined') {
          localStorage.setItem(TOKEN_KEY, response.token)
          localStorage.setItem(USER_KEY, JSON.stringify(response.user))
        }

        setIsAuthenticated(true)
        setUser(response.user)
        
        router.replace('/dashboard')
      }
    } catch (error) {
      console.error('Erro no login:', error)
      throw new Error(error.message || 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email, password, nome, clinica_nome) => {
    try {
      setLoading(true)
      
      const response = await api.signup({
        email,
        password,
        nome,
        clinica_nome
      })

      if (response && response.token && response.user) {
        // Armazenar token e usuário
        if (typeof window !== 'undefined') {
          localStorage.setItem(TOKEN_KEY, response.token)
          localStorage.setItem(USER_KEY, JSON.stringify(response.user))
        }

        setIsAuthenticated(true)
        setUser(response.user)
        
        router.replace('/dashboard')
      }
    } catch (error) {
      console.error('Erro no registro:', error)
      throw new Error(error.message || 'Erro ao fazer registro')
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      
      // Limpar localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      }

      setIsAuthenticated(false)
      setUser(null)
      router.replace('/login')
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    } finally {
      setLoading(false)
    }
  }

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

