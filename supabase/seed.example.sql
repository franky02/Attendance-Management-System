-- Example staff list (made-up names). Copy to supabase/seed.sql (which git ignores),
-- replace with your real staff exactly as printed, and run it in the Supabase SQL Editor.
insert into public.employee (display_order, full_name, designation, pf_hrms_number, code) values
  (1 , 'ARUN PRAKASH', 'SS', '10000000001', 'DEMOAA'),
  (2 , 'B. SURESH BABU', 'SS', '10000DEMO02', 'DEMOAB'),
  (3 , 'C. VIJAYAN', 'SS', '100 00000003', 'DEMOAC'),
  (4 , 'K. SUBRAMANIAN SRINIVAS', 'SS', '10000D00004', 'DEMOAD'),
  (5 , 'D. KARTHIKEYAN', 'SM', '10000DEM005', 'DEMOAE'),
  (6 , 'E. SENTHIL MURUGAN', 'SM', '100DEM00006', 'DEMOAF'),
  (7 , 'F. GOPINATH RAJ', 'SM', '10000000007', 'DEMOAG'),
  (8 , 'G. BALAJI', 'SM', '10000DEMO08', 'DEMOAH'),
  (9 , 'H. MANIKANDAN', 'SM', '100 00000009', 'DEMOAI'),
  (10, 'J. DINESH', 'PM-A', '10000000010', 'DEMOAJ'),
  (11, 'L. SELVAKUMAR', 'PM-A', '10000DEMO11', 'DEMOAK'),
  (12, 'M. HARIHARAN', 'PM-A', '10000DEMO12', 'DEMOAL'),
  (13, 'N. RAJESH KANNAN', 'PM-A', '10000DEMO13', 'DEMOAM'),
  (14, 'P. VENKATARAMAN GOPAL', 'PM-A', '10000000014', 'DEMOAN'),
  (15, 'R. ANAND', 'PM-B', '100DO000015', 'DEMOAO'),
  (16, 'S. PRAVEEN KUMAR', 'PM-B', '10000000016', 'DEMOAP');
