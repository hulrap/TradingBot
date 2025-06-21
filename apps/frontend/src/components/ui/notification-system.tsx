'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X, 
  Bell,
  Volume2,
  VolumeX,
  Settings as SettingsIcon,
  Filter
} from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';
export type NotificationCategory = 'trade' | 'bot' | 'system' | 'price' | 'alert';

export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: number;
  duration?: number;
  persistent?: boolean;
  actionable?: boolean;
  actions?: NotificationAction[];
  data?: any;
  read?: boolean;
  sound?: boolean;
}

export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  categories: {
    trade: boolean;
    bot: boolean;
    system: boolean;
    price: boolean;
    alert: boolean;
  };
  types: {
    success: boolean;
    error: boolean;
    warning: boolean;
    info: boolean;
  };
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxNotifications: number;
  defaultDuration: number;
}

interface NotificationContextType {
  notifications: Notification[];
  settings: NotificationSettings;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  unreadCount: number;
}

const defaultSettings: NotificationSettings = {
  enabled: true,
  sound: true,
  categories: {
    trade: true,
    bot: true,
    system: true,
    price: true,
    alert: true,
  },
  types: {
    success: true,
    error: true,
    warning: true,
    info: true,
  },
  position: 'top-right',
  maxNotifications: 5,
  defaultDuration: 5000,
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio for notifications
  useEffect(() => {
    audioRef.current = new Audio('/notification-sound.mp3'); // You'll need to add this file
    audioRef.current.volume = 0.5;
  }, []);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    // Check if notifications are enabled for this type/category
    if (!settings.enabled || 
        !settings.categories[notification.category] || 
        !settings.types[notification.type]) {
      return;
    }

    const newNotification: Notification = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      read: false,
      duration: notification.duration ?? settings.defaultDuration,
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      
      // Limit the number of notifications
      if (updated.length > settings.maxNotifications) {
        return updated.slice(0, settings.maxNotifications);
      }
      
      return updated;
    });

    // Play sound if enabled
    if (settings.sound && notification.sound !== false && audioRef.current) {
      audioRef.current.play().catch(console.error);
    }

    // Auto-remove non-persistent notifications
    if (!notification.persistent && newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, newNotification.duration);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const updateSettings = (newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const value: NotificationContextType = {
    notifications,
    settings,
    addNotification,
    removeNotification,
    clearAll,
    markAsRead,
    markAllAsRead,
    updateSettings,
    unreadCount,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// Toast notification component
function ToastNotification({ notification, onClose }: { 
  notification: Notification; 
  onClose: () => void; 
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleClose = () => {
    setIsRemoving(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getBorderColor = () => {
    switch (notification.type) {
      case 'success':
        return 'border-green-400';
      case 'error':
        return 'border-red-400';
      case 'warning':
        return 'border-yellow-400';
      case 'info':
        return 'border-blue-400';
    }
  };

  return (
    <div
      className={`
        relative p-4 mb-3 bg-gray-800 border-l-4 ${getBorderColor()} rounded-lg shadow-lg
        transform transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${isRemoving ? 'translate-x-full opacity-0' : ''}
        max-w-sm w-full
      `}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-white">
                {notification.title}
              </h4>
              <p className="mt-1 text-sm text-gray-300">
                {notification.message}
              </p>
              
              {notification.actions && notification.actions.length > 0 && (
                <div className="mt-3 flex space-x-2">
                  {notification.actions.map((action, index) => (
                    <button
                      key={index}
                      onClick={action.action}
                      className={`
                        px-3 py-1 text-xs font-medium rounded transition-colors
                        ${action.style === 'primary' 
                          ? 'bg-blue-600 text-white hover:bg-blue-700' 
                          : action.style === 'danger'
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                        }
                      `}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button
              onClick={handleClose}
              className="ml-2 flex-shrink-0 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-2 text-xs text-gray-500">
        {new Date(notification.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

// Toast container component
export function ToastContainer() {
  const { notifications, settings, removeNotification } = useNotifications();

  const getPositionClasses = () => {
    switch (settings.position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      default:
        return 'top-4 right-4';
    }
  };

  if (!settings.enabled) return null;

  return (
    <div className={`fixed ${getPositionClasses()} z-50 pointer-events-none`}>
      <div className="space-y-2 pointer-events-auto">
        {notifications
          .filter(n => !n.persistent)
          .slice(0, settings.maxNotifications)
          .map(notification => (
            <ToastNotification
              key={notification.id}
              notification={notification}
              onClose={() => removeNotification(notification.id)}
            />
          ))}
      </div>
    </div>
  );
}

// Notification bell component
export function NotificationBell() {
  const { notifications, unreadCount, markAllAsRead } = useNotifications();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [activeFilter, setActiveFilter] = useState<{
    category?: NotificationCategory;
    type?: NotificationType;
  }>({});

  // Filter notifications based on active filter
  const filteredNotifications = notifications.filter(notification => {
    if (activeFilter.category && notification.category !== activeFilter.category) {
      return false;
    }
    if (activeFilter.type && notification.type !== activeFilter.type) {
      return false;
    }
    return true;
  });

  const clearFilter = () => {
    setActiveFilter({});
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-300 hover:text-white transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Notifications</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowFilter(!showFilter)}
                  className={`p-1 transition-colors ${
                    activeFilter.category || activeFilter.type 
                      ? 'text-blue-400 hover:text-blue-300' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Filter notifications"
                >
                  <Filter className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                  <SettingsIcon className="w-4 h-4" />
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilter && (
            <div className="p-4 border-b border-gray-700 bg-gray-750">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-white">Filter Notifications</h4>
                {(activeFilter.category || activeFilter.type) && (
                  <button
                    onClick={clearFilter}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Category</label>
                  <select
                    value={activeFilter.category || ''}
                    onChange={(e) => setActiveFilter(prev => ({ 
                      ...prev, 
                      category: e.target.value as NotificationCategory || undefined 
                    }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded text-white text-xs p-1"
                  >
                    <option value="">All</option>
                    <option value="trade">Trade</option>
                    <option value="bot">Bot</option>
                    <option value="system">System</option>
                    <option value="price">Price</option>
                    <option value="alert">Alert</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Type</label>
                  <select
                    value={activeFilter.type || ''}
                    onChange={(e) => setActiveFilter(prev => ({ 
                      ...prev, 
                      type: e.target.value as NotificationType || undefined 
                    }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded text-white text-xs p-1"
                  >
                    <option value="">All</option>
                    <option value="success">Success</option>
                    <option value="error">Error</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="max-h-96 overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                {(activeFilter.category || activeFilter.type) ? 'No notifications match your filter' : 'No notifications'}
              </div>
            ) : (
              filteredNotifications.slice(0, 10).map(notification => (
                <NotificationItem 
                  key={notification.id} 
                  notification={notification} 
                />
              ))
            )}
          </div>

          {showSettings && <NotificationSettings />}
        </div>
      )}
    </div>
  );
}

// Individual notification item in dropdown
function NotificationItem({ notification }: { notification: Notification }) {
  const { markAsRead, removeNotification } = useNotifications();

  const getCategoryColor = () => {
    switch (notification.category) {
      case 'trade':
        return 'text-green-400';
      case 'bot':
        return 'text-blue-400';
      case 'system':
        return 'text-yellow-400';
      case 'price':
        return 'text-purple-400';
      case 'alert':
        return 'text-red-400';
    }
  };

  return (
    <div 
      className={`p-4 border-b border-gray-700 hover:bg-gray-700 transition-colors cursor-pointer ${
        !notification.read ? 'bg-gray-750' : ''
      }`}
      onClick={() => !notification.read && markAsRead(notification.id)}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {notification.type === 'success' && <CheckCircle className="w-4 h-4 text-green-400" />}
          {notification.type === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
          {notification.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-400" />}
          {notification.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-medium text-white truncate">
              {notification.title}
            </h5>
            <span className={`text-xs ${getCategoryColor()}`}>
              {notification.category.toUpperCase()}
            </span>
          </div>
          
          <p className="mt-1 text-sm text-gray-300 line-clamp-2">
            {notification.message}
          </p>
          
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {new Date(notification.timestamp).toLocaleString()}
            </span>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeNotification(notification.id);
              }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
      
      {!notification.read && (
        <div className="absolute left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-500 rounded-full"></div>
      )}
    </div>
  );
}

// Notification settings panel
function NotificationSettings() {
  const { settings, updateSettings } = useNotifications();

  return (
    <div className="p-4 border-t border-gray-700">
      <h4 className="text-sm font-medium text-white mb-3">Notification Settings</h4>
      
      <div className="space-y-3">
        <label className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Enable notifications</span>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => updateSettings({ enabled: e.target.checked })}
            className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
          />
        </label>
        
        <label className="flex items-center justify-between">
          <span className="text-sm text-gray-300 flex items-center">
            {settings.sound ? <Volume2 className="w-4 h-4 mr-1" /> : <VolumeX className="w-4 h-4 mr-1" />}
            Sound alerts
          </span>
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(e) => updateSettings({ sound: e.target.checked })}
            className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
          />
        </label>

        <div>
          <label className="block text-sm text-gray-300 mb-2">Categories</label>
          <div className="space-y-1">
            {Object.entries(settings.categories).map(([category, enabled]) => (
              <label key={category} className="flex items-center justify-between">
                <span className="text-xs text-gray-400 capitalize">{category}</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => updateSettings({
                    categories: { ...settings.categories, [category]: e.target.checked }
                  })}
                  className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-2">Position</label>
          <select
            value={settings.position}
            onChange={(e) => updateSettings({ position: e.target.value as any })}
            className="w-full bg-gray-700 border border-gray-600 rounded text-white text-sm p-1"
          >
            <option value="top-right">Top Right</option>
            <option value="top-left">Top Left</option>
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-left">Bottom Left</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// Hook for easy notification creation
export function useNotificationHelpers() {
  const { addNotification } = useNotifications();

  const notifyTrade = (type: 'success' | 'error', title: string, message: string, data?: any) => {
    addNotification({
      type,
      category: 'trade',
      title,
      message,
      data,
      sound: true,
    });
  };

  const notifyBot = (type: NotificationType, title: string, message: string, data?: any) => {
    addNotification({
      type,
      category: 'bot',
      title,
      message,
      data,
      sound: type === 'error',
    });
  };

  const notifyPrice = (title: string, message: string, data?: any) => {
    addNotification({
      type: 'info',
      category: 'price',
      title,
      message,
      data,
      duration: 3000,
    });
  };

  const notifyAlert = (title: string, message: string, actions?: NotificationAction[]) => {
    addNotification({
      type: 'warning',
      category: 'alert',
      title,
      message,
      persistent: true,
      ...(actions && { actions }),
      sound: true,
    });
  };

  const notifySystem = (type: NotificationType, title: string, message: string) => {
    addNotification({
      type,
      category: 'system',
      title,
      message,
      sound: type === 'error',
    });
  };

  return {
    notifyTrade,
    notifyBot,
    notifyPrice,
    notifyAlert,
    notifySystem,
  };
}