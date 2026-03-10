import pg from 'pg';

const connectionString = 'postgresql://postgres:Anshul@13.#@db.rpqeavqoidtwfxzmdplb.supabase.co:5432/postgres';

const pool = new pg.Pool({
  connectionString,
});

const sql = `
-- Allow Admins to INSERT buses
CREATE POLICY "Admins can insert buses"
ON public.buses FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Allow Admins to UPDATE buses
CREATE POLICY "Admins can update buses"
ON public.buses FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Allow Admins to DELETE buses
CREATE POLICY "Admins can delete buses"
ON public.buses FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);
`;

async function runSQL() {
  try {
    console.log('Connecting to database...');
    await pool.query(sql);
    console.log('SQL Executed successfully!');
  } catch (err) {
    if (err.message.includes('already exists')) {
       console.log('Policies already exist. Success!');
    } else {
       console.error('Error executing SQL:', err);
    }
  } finally {
    await pool.end();
  }
}

runSQL();
