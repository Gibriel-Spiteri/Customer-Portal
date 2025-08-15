#!/usr/bin/env tsx
// Script to update user names from NetSuite for users with missing firstName/lastName

import { db } from './db';
import { users } from '@shared/schema';
import { eq, isNull, or } from 'drizzle-orm';
import { NetSuiteM2M } from './services/netsuite-m2m';

async function updateUserNamesFromNetSuite() {
  console.log('Starting to update user names from NetSuite...');
  
  try {
    // Find users with NetSuite customer ID but missing names
    const usersToUpdate = await db
      .select()
      .from(users)
      .where(
        or(
          isNull(users.firstName),
          isNull(users.lastName),
          eq(users.firstName, ''),
          eq(users.lastName, '')
        )
      );
    
    console.log(`Found ${usersToUpdate.length} users with missing names`);
    
    if (usersToUpdate.length === 0) {
      console.log('No users need updating');
      return;
    }
    
    const m2m = new NetSuiteM2M();
    
    for (const user of usersToUpdate) {
      if (!user.netsuiteCustomerId) {
        console.log(`User ${user.email} has no NetSuite customer ID, skipping...`);
        continue;
      }
      
      console.log(`Fetching data for user ${user.email} (Customer ID: ${user.netsuiteCustomerId})...`);
      
      try {
        // Fetch customer data from NetSuite
        const customerData = await m2m.getCustomerAccount(user.netsuiteCustomerId);
        
        if (customerData) {
          const updates: any = {};
          
          // Only update if we got valid data from NetSuite
          if (customerData.firstName && !user.firstName) {
            updates.firstName = customerData.firstName;
          }
          if (customerData.lastName && !user.lastName) {
            updates.lastName = customerData.lastName;
          }
          if (customerData.companyName && !user.companyName) {
            updates.companyName = customerData.companyName;
          }
          
          if (Object.keys(updates).length > 0) {
            await db
              .update(users)
              .set({
                ...updates,
                updatedAt: new Date()
              })
              .where(eq(users.id, user.id));
            
            console.log(`Updated user ${user.email}:`, updates);
          } else {
            console.log(`No updates needed for user ${user.email}`);
          }
        } else {
          console.log(`No customer data found in NetSuite for ${user.email}`);
        }
      } catch (error) {
        console.error(`Error updating user ${user.email}:`, error);
      }
    }
    
    console.log('Finished updating user names');
    process.exit(0);
  } catch (error) {
    console.error('Error in update process:', error);
    process.exit(1);
  }
}

// Run the update
updateUserNamesFromNetSuite();