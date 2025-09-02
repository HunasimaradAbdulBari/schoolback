// scripts/migrate.js
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB for migration');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

// Migration functions
const migrateUsers = async () => {
  try {
    console.log('🔄 Starting user migration...');
    
    const User = require('../models/User');
    
    // Update all existing users to have admin role if they don't have a role
    const result = await User.updateMany(
      { role: { $exists: false } },
      { 
        $set: { 
          role: 'admin',
          isActive: true,
          studentIds: []
        }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} users with admin role`);

    // Create indexes
    await User.collection.createIndex({ phone: 1, role: 1 });
    console.log('✅ Created user indexes');

  } catch (error) {
    console.error('❌ User migration failed:', error);
    throw error;
  }
};

const migrateStudents = async () => {
  try {
    console.log('🔄 Starting student migration...');
    
    const Student = require('../models/student');
    
    // Generate Student IDs for existing students without IDs
    const studentsWithoutId = await Student.find({ 
      $or: [
        { studentId: { $exists: false } },
        { studentId: null },
        { studentId: '' }
      ]
    });

    console.log(`Found ${studentsWithoutId.length} students without Student IDs`);

    for (let i = 0; i < studentsWithoutId.length; i++) {
      const student = studentsWithoutId[i];
      let newId = `AS${String(i + 1).padStart(4, '0')}`;
      
      // Ensure uniqueness
      while (await Student.findOne({ studentId: newId })) {
        const randomSuffix = Math.floor(Math.random() * 9000) + 1000;
        newId = `AS${randomSuffix}`;
      }
      
      student.studentId = newId;
      await student.save();
      console.log(`✅ Assigned ID ${newId} to student: ${student.name}`);
    }

    console.log('✅ Student ID migration completed');

  } catch (error) {
    console.error('❌ Student migration failed:', error);
    throw error;
  }
};

const createParentAccounts = async () => {
  try {
    console.log('🔄 Creating parent accounts from student data...');
    
    const Student = require('../models/student');
    const User = require('../models/User');
    const bcrypt = require('bcryptjs');
    
    // Get all unique parent phone numbers
    const parentPhones = await Student.aggregate([
      { 
        $match: { 
          parentPhone: { $exists: true, $ne: null, $ne: '' }
        }
      },
      {
        $group: {
          _id: '$parentPhone',
          parentName: { $first: '$parentName' },
          students: { $push: { _id: '$_id', name: '$name', studentId: '$studentId' } }
        }
      }
    ]);

    console.log(`Found ${parentPhones.length} unique parent phone numbers`);

    let createdCount = 0;
    
    for (const parentData of parentPhones) {
      const phone = parentData._id;
      const parentName = parentData.parentName || 'Parent';
      const students = parentData.students;

      // Check if parent account already exists
      const existingParent = await User.findOne({ phone: phone, role: 'parent' });
      
      if (!existingParent) {
        // Create parent account
        const defaultPassword = await bcrypt.hash('123456', 12); // Default password
        
        const parentUser = new User({
          name: parentName,
          username: phone, // Use phone as username
          phone: phone,
          password: defaultPassword,
          role: 'parent',
          carrier: 'airtel', // Default carrier
          isPhoneVerified: false, // They'll need to verify via OTP
          studentIds: students.map(s => s._id),
          isActive: true
        });

        await parentUser.save();
        createdCount++;
        
        console.log(`✅ Created parent account for ${parentName} (${phone}) with ${students.length} students`);
      } else {
        // Update existing parent with any missing students
        const missingStudents = students.filter(s => 
          !existingParent.studentIds.includes(s._id)
        );
        
        if (missingStudents.length > 0) {
          existingParent.studentIds.push(...missingStudents.map(s => s._id));
          await existingParent.save();
          console.log(`✅ Linked ${missingStudents.length} additional students to existing parent: ${parentName}`);
        }
      }
    }

    console.log(`✅ Parent account creation completed. Created ${createdCount} new accounts.`);
    
    // Log instructions for default passwords
    if (createdCount > 0) {
      console.log('\n📋 IMPORTANT: Default parent accounts created with password "123456"');
      console.log('👉 Parents should login with their phone number and change their password');
      console.log('👉 They can also re-register with OTP verification to set a new password');
    }

  } catch (error) {
    console.error('❌ Parent account creation failed:', error);
    throw error;
  }
};

const createPaymentIndexes = async () => {
  try {
    console.log('🔄 Creating payment collection indexes...');
    
    const Payment = require('../models/Payment');
    
    // Ensure payment collection exists and create indexes
    await Payment.collection.createIndex({ studentId: 1, parentId: 1 });
    await Payment.collection.createIndex({ status: 1 });
    await Payment.collection.createIndex({ createdAt: -1 });
    await Payment.collection.createIndex({ receiptNumber: 1 }, { unique: true });
    
    console.log('✅ Payment indexes created successfully');

  } catch (error) {
    console.error('❌ Payment index creation failed:', error);
    throw error;
  }
};

// Main migration function
const runMigration = async () => {
  try {
    console.log('🚀 Starting Astra Preschool database migration...');
    console.log('='.repeat(60));
    
    await connectDB();
    
    await migrateUsers();
    await migrateStudents();
    await createParentAccounts();
    await createPaymentIndexes();
    
    console.log('='.repeat(60));
    console.log('🎉 Migration completed successfully!');
    console.log('📝 Migration Summary:');
    console.log('   • User roles updated to support admin/parent system');
    console.log('   • Student IDs generated for existing students');  
    console.log('   • Parent accounts created from student data');
    console.log('   • Payment system indexes created');
    console.log('   • Database ready for enhanced features');
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration if called directly
if (require.main === module) {
  runMigration();
}

module.exports = {
  runMigration,
  migrateUsers,
  migrateStudents,
  createParentAccounts,
  createPaymentIndexes
};
