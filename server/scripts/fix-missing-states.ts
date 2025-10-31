import { db } from "../db";
import { memberHistory } from "@shared/schema";
import { sql, and, isNotNull, or, eq } from "drizzle-orm";
import zipcodes from "zipcodes";

async function fixMissingStates() {
  console.log('🔧 Starting state fix for records with ZIP codes but no state...');
  
  // Get all records with ZIP code but no state
  const recordsWithoutState = await db.select({
    phoneNumber: memberHistory.phoneNumber,
    zipCode: memberHistory.zipCode
  })
  .from(memberHistory)
  .where(
    and(
      isNotNull(memberHistory.zipCode),
      sql`${memberHistory.zipCode} != ''`,
      or(
        sql`${memberHistory.state} IS NULL`,
        sql`${memberHistory.state} = ''`
      )
    )
  );

  console.log(`📊 Found ${recordsWithoutState.length} records to update`);

  let updated = 0;
  let failed = 0;

  // Process in batches
  for (const record of recordsWithoutState) {
    try {
      // Clean ZIP code (remove suffix like -5422)
      const cleanZip = record.zipCode!.split('-')[0].trim();
      
      // Lookup state
      const result = zipcodes.lookup(cleanZip);
      
      if (result && result.state) {
        // Update record
        await db.update(memberHistory)
          .set({ state: result.state })
          .where(eq(memberHistory.phoneNumber, record.phoneNumber));
        
        updated++;
        
        if (updated % 100 === 0) {
          console.log(`✅ Updated ${updated}/${recordsWithoutState.length} records...`);
        }
      } else {
        failed++;
        console.warn(`⚠️ Could not find state for ZIP ${cleanZip}`);
      }
    } catch (error) {
      failed++;
      console.error(`❌ Error updating ${record.phoneNumber}:`, error);
    }
  }

  console.log(`\n🎉 DONE!`);
  console.log(`✅ Successfully updated: ${updated}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total processed: ${recordsWithoutState.length}`);
  
  process.exit(0);
}

fixMissingStates().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
