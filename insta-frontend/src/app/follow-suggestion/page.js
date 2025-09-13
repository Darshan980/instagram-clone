// src/app/follow-suggestion/page.js
import FollowSuggestions from '@/components/FollowSuggestions';

export default function FollowSuggestionsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-8 text-center">
          Discover People
        </h1>
        <FollowSuggestions />
      </div>
    </div>
  );
}