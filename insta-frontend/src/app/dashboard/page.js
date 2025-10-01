'use client';

import { useState, useEffect } from 'react';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import ChartSection from './components/ChartSection';
import RecentActivity from './components/RecentActivity';
import { fetchDashboardData } from './utils/api';
import Sidebar from '../components/layout/Sidebar';
import CreateSidebar from '../components/layout/CreateSidebar';
import Feed from './components/Feed';
import { useDashboard } from './hooks/useDashboard';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const result = await fetchDashboardData();
      setData(result);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StatsCards stats={data?.stats} />
        <ChartSection chartData={data?.chartData} />
        <RecentActivity activities={data?.activities} />
      </main>
    </div>
  );
}
