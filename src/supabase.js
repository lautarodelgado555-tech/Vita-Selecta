import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mcezhcyumirmnlttowuz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jZXpoY3l1bWlybW5sdHRvd3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5Njc3NDcsImV4cCI6MjA5NTU0Mzc0N30.54oxdaUR026zTXt8k9P-o9Le8bonMzcFfsk3bAgKEIU'

export const supabase = createClient(supabaseUrl, supabaseKey)