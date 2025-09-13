// migration-script.js
// Run this ONCE after updating your User schema

const mongoose = require('mongoose');
const User = require('./schema/user.js'); // Adjust path as needed
const Post = require('./schema/post.js'); // Adjust path as needed

// Connect to your database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database-name';

async function runMigration() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('🔧 Starting user counter migration...');
    
    const users = await User.find({});
    console.log(`📊 Found ${users.length} users to migrate`);

    let migrated = 0;
    let errors = 0;

    for (const user of users) {
      try {
        // Calculate actual counts
        const actualPostsCount = await Post.countDocuments({ user: user._id });
        const actualFollowersCount = user.followers ? user.followers.length : 0;
        const actualFollowingCount = user.following ? user.following.length : 0;

        // Current stored counts (might be undefined)
        const currentPostsCount = user.postsCount || 0;
        const currentFollowersCount = user.followersCount || 0;
        const currentFollowingCount = user.followingCount || 0;

        // Check if migration is needed
        const needsUpdate = 
          currentPostsCount !== actualPostsCount ||
          currentFollowersCount !== actualFollowersCount ||
          currentFollowingCount !== actualFollowingCount;

        if (needsUpdate) {
          await User.findByIdAndUpdate(user._id, {
            postsCount: actualPostsCount,
            followersCount: actualFollowersCount,
            followingCount: actualFollowingCount
          });

          console.log(`✅ Migrated ${user.username}:`);
          console.log(`   Posts: ${currentPostsCount} -> ${actualPostsCount}`);
          console.log(`   Followers: ${currentFollowersCount} -> ${actualFollowersCount}`);
          console.log(`   Following: ${currentFollowingCount} -> ${actualFollowingCount}`);
          
          migrated++;
        } else {
          console.log(`⏭️  ${user.username} already up to date`);
        }

      } catch (userError) {
        console.error(`❌ Error migrating user ${user.username}:`, userError);
        errors++;
      }
    }

    console.log('\n🎉 Migration completed!');
    console.log(`✅ Successfully migrated: ${migrated} users`);
    console.log(`❌ Errors encountered: ${errors} users`);
    
    if (errors === 0) {
      console.log('🎊 All users migrated successfully!');
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
  } finally {
    console.log('🔌 Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  runMigration();
}

module.exports = runMigration;