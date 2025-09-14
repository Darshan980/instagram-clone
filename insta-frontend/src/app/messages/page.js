'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { getToken, isTokenValid } from '../../utils/auth';
import Layout from '../components/Layout';
import styles from './messages.module.css';

export default function MessagesPage() {
  // FIXED: Initialize all arrays as empty arrays to prevent undefined errors
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]); // FIXED: Initialize as empty array
  const [showSearch, setShowSearch] = useState(false);
  const [searchError, setSearchError] = useState('');
  const messagesEndRef = useRef(null);
  const router = useRouter();

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isTokenValid()) {
      router.push('/login');
      return;
    }

    fetchCurrentUser();
    fetchConversations();
  }, [router]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchCurrentUser = async () => {
    try {
      const token = getToken();
      const response = await axios.get('https://instagram-clone-0t5v.onrender.com/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentUser(response.data.user);
    } catch (error) {
      console.error('Error fetching current user:', error);
      if (error.response?.status === 401) {
        router.push('/login');
      }
    }
  };

  const fetchConversations = async () => {
    try {
      const token = getToken();
      const response = await axios.get('https://instagram-clone-0t5v.onrender.com/api/conversations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // FIXED: Ensure conversations is always an array
      const conversationsData = response.data?.conversations || [];
      setConversations(Array.isArray(conversationsData) ? conversationsData : []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      // FIXED: Set empty array on error to prevent undefined access
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (userId) => {
    try {
      const token = getToken();
      const response = await axios.get(`https://instagram-clone-0t5v.onrender.com/api/messages/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // FIXED: Ensure messages is always an array
      const messagesData = response.data?.messages || [];
      setMessages(Array.isArray(messagesData) ? messagesData : []);
      setSelectedConversation(response.data.otherUser);
    } catch (error) {
      console.error('Error fetching messages:', error);
      // FIXED: Set empty array on error
      setMessages([]);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || sendingMessage) return;

    setSendingMessage(true);
    try {
      const token = getToken();
      const response = await axios.post('https://instagram-clone-0t5v.onrender.com/api/messages', {
        receiverId: selectedConversation.id,
        text: newMessage.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // FIXED: Safely update messages array
      setMessages(prev => {
        const prevMessages = Array.isArray(prev) ? prev : [];
        return [...prevMessages, response.data.data];
      });
      setNewMessage('');
      fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const searchUsers = async (query) => {
    if (!query || typeof query !== 'string' || !query.trim()) {
      setSearchResults([]);
      setSearchError('');
      return;
    }

    if (query.trim().length < 2) {
      setSearchResults([]);
      setSearchError('Please enter at least 2 characters to search');
      return;
    }

    try {
      const token = getToken();
      console.log('🔍 Messages: Searching for users with query:', query.trim());
      
      const response = await axios.get(`https://instagram-clone-0t5v.onrender.com/api/users/search/${encodeURIComponent(query.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('🔍 Messages: Search response:', response.data);
      
      // FIXED: Handle the nested data structure correctly
      let users = [];
      if (response.data?.success && response.data?.data?.users) {
        // New API structure with success flag and nested data
        users = response.data.data.users;
      } else if (response.data?.users) {
        // Legacy API structure with direct users array
        users = response.data.users;
      }
      
      // FIXED: Ensure users is always an array
      const safeUsers = Array.isArray(users) ? users : [];
      setSearchResults(safeUsers);
      setSearchError('');
      
      console.log('✅ Messages: Set search results:', safeUsers.length, 'users');
      
    } catch (error) {
      console.error('Error searching users:', error);
      
      if (error.response?.status === 400) {
        setSearchResults([]);
        setSearchError(error.response.data.message || 'Invalid search query');
      } else {
        setSearchError('Failed to search users. Please try again.');
        setSearchResults([]);
      }
    }
  };

  const startNewConversation = (user) => {
    if (!user || !user._id) {
      console.error('Invalid user object for new conversation:', user);
      return;
    }

    setSelectedConversation({
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      profilePicture: user.profilePicture
    });
    setMessages([]);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = (now - date) / (1000 * 60 * 60);

      if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffInHours < 168) {
        return date.toLocaleDateString([], { weekday: 'short' });
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    } catch (error) {
      console.error('Error formatting time:', error);
      return '';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}></div>
          <span>Loading messages...</span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.messagesContainer}>
        <div className={styles.messagesLayout}>
          {/* Conversations Panel */}
          <div className={styles.conversationsPanel}>
            <div className={styles.conversationsHeader}>
              <h2>{currentUser?.username || 'User'}</h2>
              <button 
                className={styles.newMessageBtn}
                onClick={() => setShowSearch(!showSearch)}
                title="New message"
              >
                ✏️
              </button>
            </div>

            {/* Search for new conversations */}
            {showSearch && (
              <div className={styles.searchSection}>
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchError('');
                    searchUsers(e.target.value);
                  }}
                  className={styles.searchInput}
                />
                {searchError && <div className={styles.searchError}>{searchError}</div>}
                {/* FIXED: Safe array access with length check */}
                {Array.isArray(searchResults) && searchResults.length > 0 && (
                  <div className={styles.searchResults}>
                    {searchResults.map(user => {
                      // FIXED: Validate user object before rendering
                      if (!user || !user._id) {
                        console.warn('Invalid user in search results:', user);
                        return null;
                      }
                      
                      return (
                        <div
                          key={user._id}
                          className={styles.searchResult}
                          onClick={() => startNewConversation(user)}
                        >
                          <img
                            src={user.profilePicture || 
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || 'User')}&size=400&background=0095f6&color=fff`
                            }
                            alt={user.username || 'User'}
                            className={styles.searchAvatar}
                            onError={(e) => {
                              if (!e.target.src.includes('ui-avatars.com')) {
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || 'User')}&size=400&background=0095f6&color=fff`;
                              }
                            }}
                          />
                          <div className={styles.searchUserInfo}>
                            <div className={styles.searchUsername}>{user.username || 'Unknown'}</div>
                            <div className={styles.searchFullName}>{user.fullName || ''}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Conversations List */}
            <div className={styles.conversationsList}>
              {/* FIXED: Safe array access */}
              {!Array.isArray(conversations) || conversations.length === 0 ? (
                <div className={styles.noConversations}>
                  <div className={styles.noConversationsIcon}>💬</div>
                  <h3>No messages, yet</h3>
                  <p>Start a conversation</p>
                </div>
              ) : (
                conversations.map(conversation => {
                  // FIXED: Validate conversation object
                  if (!conversation || !conversation._id || !conversation.participant) {
                    console.warn('Invalid conversation object:', conversation);
                    return null;
                  }
                  
                  return (
                    <div
                      key={conversation._id}
                      className={`${styles.conversationItem} ${
                        selectedConversation?.id === conversation.participant._id ? styles.active : ''
                      }`}
                      onClick={() => fetchMessages(conversation.participant._id)}
                    >
                      <img
                        src={conversation.participant.profilePicture || 
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(conversation.participant.username || 'User')}&size=400&background=0095f6&color=fff`
                        }
                        alt={conversation.participant.username || 'User'}
                        className={styles.avatar}
                        onError={(e) => {
                          if (!e.target.src.includes('ui-avatars.com')) {
                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(conversation.participant.username || 'User')}&size=400&background=0095f6&color=fff`;
                          }
                        }}
                      />
                      <div className={styles.conversationInfo}>
                        <div className={styles.conversationHeader}>
                          <span className={styles.username}>{conversation.participant.username || 'Unknown'}</span>
                          <span className={styles.time}>
                            {formatTime(conversation.lastMessageAt)}
                          </span>
                        </div>
                        <div className={styles.lastMessage}>
                          {conversation.lastMessage?.text || 'Photo'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat Window */}
          <div className={styles.chatWindow}>
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className={styles.chatHeader}>
                  <img
                    src={selectedConversation.profilePicture || 
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedConversation.username || 'User')}&size=400&background=0095f6&color=fff`
                    }
                    alt={selectedConversation.username || 'User'}
                    className={styles.chatAvatar}
                    onError={(e) => {
                      if (!e.target.src.includes('ui-avatars.com')) {
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedConversation.username || 'User')}&size=400&background=0095f6&color=fff`;
                      }
                    }}
                  />
                  <div className={styles.chatUserInfo}>
                    <div className={styles.chatUsername}>{selectedConversation.username || 'Unknown'}</div>
                    <div className={styles.chatFullName}>{selectedConversation.fullName || ''}</div>
                  </div>
                </div>

                {/* Messages */}
                <div className={styles.messagesArea}>
                  {/* FIXED: Safe array access */}
                  {!Array.isArray(messages) || messages.length === 0 ? (
                    <div className={styles.noMessages}>
                      <div className={styles.noMessagesIcon}>💬</div>
                      <p>No messages yet</p>
                      <p>Send a message to start the conversation</p>
                    </div>
                  ) : (
                    messages.map(message => {
                      // FIXED: Validate message object
                      if (!message || !message._id) {
                        console.warn('Invalid message object:', message);
                        return null;
                      }
                      
                      return (
                        <div
                          key={message._id}
                          className={`${styles.message} ${
                            message.senderId?._id === currentUser?.id ? styles.sent : styles.received
                          }`}
                        >
                          {message.imageUrl && (
                            <img
                              src={message.imageUrl}
                              alt="Message attachment"
                              className={styles.messageImage}
                            />
                          )}
                          {message.text && (
                            <div className={styles.messageText}>{message.text}</div>
                          )}
                          <div className={styles.messageTime}>
                            {formatTime(message.createdAt)}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <form onSubmit={sendMessage} className={styles.messageForm}>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Message..."
                    className={styles.messageInput}
                    disabled={sendingMessage}
                  />
                  <button
                    type="submit"
                    className={styles.sendButton}
                    disabled={!newMessage.trim() || sendingMessage}
                  >
                    {sendingMessage ? '...' : 'Send'}
                  </button>
                </form>
              </>
            ) : (
              <div className={styles.noChatSelected}>
                <div className={styles.noChatContent}>
                  <div className={styles.messageIcon}>✈️</div>
                  <h3>Your Messages</h3>
                  <p>Send private photos and messages to a friend or group.</p>
                  <button
                    className={styles.sendMessageBtn}
                    onClick={() => setShowSearch(true)}
                  >
                    Send Message
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
