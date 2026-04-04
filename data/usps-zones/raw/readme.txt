IMPORTANT INFORMATION RELATING TO THE EXCEPTION.TXT FILE!!!                     
                                                                                
There are 3 distinct groups of 'exceptions' identified by 'mail types'          
00, 01 & 99 found in the exception.txt file. Use the following guide            
to determine which group(s) of 'exceptions' to use to extract the required      
final & correct Zone results for each of the 3 'exception' mail types           
described below.                                                                
                                                                                
1. Mail Type 00 Outbound Zone rated mail sent to the Freely Associated          
States (FAS/Zone 9) deployed April 1, 2014.                                     
                                                                                
NOTE: Mail originating from 962 through 969 sent to 969 ZIP Codes is            
not affected. Use the Zone Chart Matrix assignment for those O/D pairs.         
                                                                                
2. Mail Type 01 - 'Outbound' Priority Mail & USPS Ground Advantage (<16 oz.)    
processed in Chicago & sent to Military ZIP Codes 090-099 and 962-966.          
Priority Mail Express is not subject to these 'exceptions'.                     
                                                                                
3. Mail Type 99 - IMPORTANT!! Use these 'Inbound' exceptions deployed           
June 1, 2018 to calculate Zone results for Zone rated mail sent from selected   
5DG Origin Military Post Office ZIP Codes only (090XX-099XX,340XX,962XX-966XX)  
& sent to 3DG domestic USA ZIP Codes. These 5DG exceptions have no impact on    
'Outbound' Retail or Outbound Commercial Zone pricing or preparation.           
                                                                                
Note:  Users should ignore any inactive 5DG Military Post Office ZIP Codes      
that are included within any Origin or Destination, Start to End exception.txt  
'ranges'.                                                                       
                                                                                
*****************************************************************************   
                                                                                
Defining a Zone                                                                 
                                                                                
*Local Zone DMM 608.9.4.1 - Local applies to USPS Connect Local and USPS Connect
                                                                                
Local Mail pieces deposited at any Post Office for delivery to addresses within 
the delivery area of that Post Office. For various types of Post Offices, local 
applies to all mail that both originates and destinates within:                 
a. The 5-digit ZIP Code area(s) assigned to the same Post Office.               
b. Any of the 5-digit ZIP Codes that are part of any unique 3-digit ZIP Code    
prefix(es) or other separate 5-digit ZIP Code(s), as applicable, assigned to    
the same Post Office. (Zone Chart Matrix does not contain local zone infor-     
mation since local zones are at the 5-digit ZIP Code level.)                    
                                                                                
*Non-Local Zone - Non-local zones are defined numerically as follows:           
Zone   Distance                                                                 
1      Non-local zones within a 50 mile radius of the point of origination      
2      51 to 150 mile radius                                                    
3      151 to 300 mile radius                                                   
4      301 to 600 mile radius                                                   
5      601 to 1000 mile radius                                                  
6      1001 to 1400 mile radius                                                 
7      1401 to 1800 mile radius                                                 
8      1801 miles & over                                                        
9*     ZIP Codes Assigned For Exceptional Network Circumstances **              
10     Offshore, Destinations only for ZIP Codes 006-009, 967-969, 995-999      
*  Except for Priority Mail & Priority Mail Express mailed to the               
   Zone 9 ZIP Codes, Zone 9 prices will be the same as Zone 8 prices.           
** Shipping between the 3-digit ZIP Codes 962-969 does not apply. Use           
Zone Chart Matrix assignment for those O/D pairs.                               
                                                                                
CURRENT ZONE CHART MATRIX FILE STRUCTURE                                        
                                                                                
Description                  Start    End       Field  Acceptable               
                             Position Position  Length Values                   
Originating ZIP Code         1        3         3      Numeric                  
Zone to Destination: ZIP 001 4        4         1      Numeric                  
Filler: ZIP 001              5        5         1      *a e b 1 or space        
                                                                                
Zone to Destination: ZIP 002 6        6         1      Numeric                  
Filler: ZIP 002              7        7         1      *a e b 1 or space        
                                                                                
Zone to Destination: ZIP 003 8        8         1      Numeric                  
Filler: ZIP 003              9        9         1      *a e b 1 or space        
                                                                                
This format continues for each 3-digit ZIP to the end of the 3 Digits           
matrix file.                                                                    
Zone to Destination: ZIP 969 1940  1940         1      Numeric                  
Filler: ZIP 969              1941  1941         1      *a e b 1 or space        
                                                                                
(etc)                                                                           
Zone to Destination: ZIP 998 1998  1998         1      Numeric                  
Filler: ZIP 998              1999  1999         1      *a e b 1 or space        
                                                                                
Zone to Destination: ZIP 999 2000  2000         1      Numeric                  
Filler: ZIP 999              2001  2001         1      *a e b 1 or space        
                                                                                
Carriage Return Line Feed    2002  2003         2                               
                                                                                
* = NDC Entry Discount indicator                                                
1 = Priority Mail & USPS Ground Advantage (< 16 oz.) going to Military          
ZIP Codes - check Exceptions File (Mail Type 01 only)                           
a = Both NDC Entry Discount indicator & Priority Mail & USPS Ground             
Advantage (<16 oz.) going to Military ZIP Codes - check Exceptions File         
(Mail Type 01 only)                                                             
e = 5-Digit ZIP Code Exception indicator - check Exceptions File (Mail Types    
00 & 99 only)                                                                   
b = Both 5-Digit ZIP Code Exception & NDC Entry Discount indicator - check      
Exceptions File (Mail Types 00 & 99 only)                                       
                                                                                
                                                                                
EXCEPTIONS FILE STRUCTURE                                                       
                                                                                
Description                 Start    End      Field  Acceptable                 
                            Position Position Length Values                     
Origin ZIP Code Range START 1        5        5      3 or 5 Numeric             
Origin ZIP Code Range END   6        10       5      3 or 5 Numeric             
Dest ZIP Code Range START   11       15       5      3 or 5 Numeric             
Dest ZIP Code Range END     16       20       5      3 or 5 Numeric             
Zone                        21       22       2   Numeric (leading zero)        
Mail Type                   23       24       2   Alpha/Numeric/Space           
                                           	'00'= Outbound sent to              
						Freely Associated States/Zone 9                                           
						'01'= Outbound Priority                                                   
						Mail & USPS Ground Advantage (<16 oz.)                                    
						& sent to 090-099 and                                                     
						962-966	Military ZIPs                                                     
						'99'= Inbound sent from                                                   
						selected 5DG Origin Military                                              
						Post Office ZIPs & sent to                                                
						3DG USA ZIPs                                                              
Filler                      25       30       6   Alpha/Numeric/Space           
Carriage Return             31       31       1                                 
