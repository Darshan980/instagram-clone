'use client';

import { useState, useEffect } from 'react';
import { getToken, isTokenValid } from '../utils/auth';

const AuthDebug = () => {
  const [authInfo, setAuthInfo] = useState(null);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
    const token = getToken();
    const allStorage = {};
    
    // Get all localStorage items
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      allStorage[key] = localStorage.getItem(key);
    }

    setAuthInfo({
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenPreview: token ? `${token.substring(0, 30)}...` : 'none',
      isValidJWT: token ? token.split('.').length === 3 : false,
      isTokenValid: isTokenValid(),
      allStorage: allStorage
    });
  };

  const testAuthAPI = async () => {
    const token = getToken();
    if (!token) {
      setTestResult('No token found');
      return;
    }

    try {
      const response = await fetch('http://localhost:10000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult(`✅ Auth working! User: ${data.user.username}`);
      } else {
        const errorText = await response.text();
        setTestResult(`❌ Auth failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      setTestResult(`❌ Network error: ${error.message}`);
    }
  };

  const clearAuth = () => {
    localStorage.removeItem('instagram_token');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuthInfo(null);
    setTestResult('Auth cleared');
    checkAuth();
  };

  if (!authInfo) return <div>Loading auth debug...</div>;

  return (
    <div style={{ 
      padding: '20px', 
      border: '1px solid #ccc', 
      margin: '20px',
      backgroundColor: '#f9f9f9',
      fontFamily: 'monospace',
      fontSize: '12px'
    }}>
      <h3>🔍 Authentication Debug</h3>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Token Status:</strong>
        <ul>
          <li>Has Token: {authInfo.hasToken ? '✅' : '❌'}</li>
          <li>Token Length: {authInfo.tokenLength}</li>
          <li>Valid JWT Format: {authInfo.isValidJWT ? '✅' : '❌'}</li>
          <li>Token Valid (not expired): {authInfo.isTokenValid ? '✅' : '❌'}</li>
          <li>Token Preview: {authInfo.tokenPreview}</li>
        </ul>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <strong>LocalStorage Contents:</strong>
        <pre>{JSON.stringify(authInfo.allStorage, null, 2)}</pre>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <button onClick={testAuthAPI} style={{ marginRight: '10px', padding: '5px 10px' }}>
          Test Auth API
        </button>
        <button onClick={clearAuth} style={{ marginRight: '10px', padding: '5px 10px' }}>
          Clear Auth
        </button>
        <button onClick={checkAuth} style={{ padding: '5px 10px' }}>
          Refresh
        </button>
      </div>

      {testResult && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: testResult.includes('✅') ? '#d4edda' : '#f8d7da',
          border: '1px solid ' + (testResult.includes('✅') ? '#c3e6cb' : '#f5c6cb'),
          borderRadius: '4px'
        }}>
          <strong>API Test Result:</strong> {testResult}
        </div>
      )}
    </div>
  );
};

export default AuthDebug;
