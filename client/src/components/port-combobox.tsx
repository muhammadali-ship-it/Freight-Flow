import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const MAJOR_PORTS = [
  // China
  { value: "Shanghai, China", code: "CNSHA" },
  { value: "Ningbo, China", code: "CNNGB" },
  { value: "Shenzhen, China", code: "CNSZX" },
  { value: "Guangzhou, China", code: "CNGZH" },
  { value: "Qingdao, China", code: "CNTAO" },
  { value: "Tianjin, China", code: "CNTXG" },
  { value: "Xiamen, China", code: "CNXMN" },
  { value: "Dalian, China", code: "CNDLC" },
  { value: "Hong Kong", code: "HKHKG" },
  
  // USA - California
  { value: "Los Angeles, CA, USA", code: "USLAX" },
  { value: "Long Beach, CA, USA", code: "USLGB" },
  { value: "Oakland, CA, USA", code: "USOAK" },
  { value: "San Diego, CA, USA", code: "USSAN" },
  { value: "San Francisco, CA, USA", code: "USSFO" },
  { value: "Richmond, CA, USA", code: "USRIC" },
  { value: "Stockton, CA, USA", code: "USSCK" },
  { value: "Sacramento, CA, USA", code: "USSAC" },
  { value: "Redwood City, CA, USA", code: "USRWD" },
  { value: "Port Hueneme, CA, USA", code: "USHUE" },
  { value: "Benicia, CA, USA", code: "USBEN" },
  { value: "West Sacramento, CA, USA", code: "USWSA" },
  
  // USA - Washington
  { value: "Seattle, WA, USA", code: "USSEA" },
  { value: "Tacoma, WA, USA", code: "USTIW" },
  { value: "Olympia, WA, USA", code: "USOLY" },
  { value: "Everett, WA, USA", code: "USPAE" },
  { value: "Bellingham, WA, USA", code: "USBLI" },
  { value: "Vancouver, WA, USA", code: "USVUO" },
  { value: "Longview, WA, USA", code: "USLGV" },
  { value: "Anacortes, WA, USA", code: "USANW" },
  { value: "Port Angeles, WA, USA", code: "USCLM" },
  
  // USA - Oregon
  { value: "Portland, OR, USA", code: "USPDX" },
  { value: "Astoria, OR, USA", code: "USAST" },
  { value: "Coos Bay, OR, USA", code: "USCOB" },
  { value: "Newport, OR, USA", code: "USNPT" },
  
  // USA - Alaska
  { value: "Anchorage, AK, USA", code: "USANC" },
  { value: "Juneau, AK, USA", code: "USJNU" },
  { value: "Ketchikan, AK, USA", code: "USKTC" },
  { value: "Sitka, AK, USA", code: "USSIT" },
  { value: "Valdez, AK, USA", code: "USVDZ" },
  { value: "Seward, AK, USA", code: "USSWD" },
  { value: "Kodiak, AK, USA", code: "USADK" },
  { value: "Nome, AK, USA", code: "USOME" },
  
  // USA - Hawaii
  { value: "Honolulu, HI, USA", code: "USHNL" },
  { value: "Hilo, HI, USA", code: "USITO" },
  { value: "Kahului, HI, USA", code: "USOGG" },
  { value: "Nawiliwili, HI, USA", code: "USLIH" },
  { value: "Kawaihae, HI, USA", code: "USKOA" },
  
  // USA - New York
  { value: "New York, NY, USA", code: "USNYC" },
  { value: "Albany, NY, USA", code: "USALB" },
  { value: "Buffalo, NY, USA", code: "USBUF" },
  { value: "Oswego, NY, USA", code: "USOSW" },
  { value: "Ogdensburg, NY, USA", code: "USOGS" },
  
  // USA - New Jersey
  { value: "Newark, NJ, USA", code: "USEWR" },
  { value: "Elizabeth, NJ, USA", code: "USEWR" },
  { value: "Jersey City, NJ, USA", code: "USJCY" },
  { value: "Camden, NJ, USA", code: "USCAM" },
  { value: "Perth Amboy, NJ, USA", code: "USPAM" },
  
  // USA - Pennsylvania
  { value: "Philadelphia, PA, USA", code: "USPHL" },
  { value: "Pittsburgh, PA, USA", code: "USPIT" },
  { value: "Erie, PA, USA", code: "USERI" },
  
  // USA - Maryland
  { value: "Baltimore, MD, USA", code: "USBAL" },
  { value: "Cambridge, MD, USA", code: "USCGE" },
  
  // USA - Virginia
  { value: "Norfolk, VA, USA", code: "USORF" },
  { value: "Newport News, VA, USA", code: "USNNV" },
  { value: "Portsmouth, VA, USA", code: "USPMH" },
  { value: "Richmond, VA, USA", code: "USRIH" },
  { value: "Alexandria, VA, USA", code: "USAXV" },
  { value: "Hampton, VA, USA", code: "USHPT" },
  
  // USA - Delaware
  { value: "Wilmington, DE, USA", code: "USILG" },
  
  // USA - North Carolina
  { value: "Wilmington, NC, USA", code: "USILM" },
  { value: "Morehead City, NC, USA", code: "USMHD" },
  
  // USA - South Carolina
  { value: "Charleston, SC, USA", code: "USCHS" },
  { value: "Georgetown, SC, USA", code: "USGGE" },
  { value: "Port Royal, SC, USA", code: "USPRY" },
  
  // USA - Georgia
  { value: "Savannah, GA, USA", code: "USSAV" },
  { value: "Brunswick, GA, USA", code: "USBQK" },
  
  // USA - Florida - East Coast
  { value: "Jacksonville, FL, USA", code: "USJAX" },
  { value: "Port Canaveral, FL, USA", code: "USPCV" },
  { value: "Fort Pierce, FL, USA", code: "USFPR" },
  { value: "Palm Beach, FL, USA", code: "USPBI" },
  { value: "Port Everglades, FL, USA", code: "USPEF" },
  { value: "Miami, FL, USA", code: "USMIA" },
  { value: "Fort Lauderdale, FL, USA", code: "USFLL" },
  
  // USA - Florida - Gulf Coast
  { value: "Tampa, FL, USA", code: "USTPA" },
  { value: "St. Petersburg, FL, USA", code: "USPIE" },
  { value: "Port Manatee, FL, USA", code: "USPMM" },
  { value: "Pensacola, FL, USA", code: "USPNS" },
  { value: "Panama City, FL, USA", code: "USPFN" },
  { value: "Port St. Joe, FL, USA", code: "USPSJ" },
  { value: "Key West, FL, USA", code: "USEYW" },
  
  // USA - Alabama
  { value: "Mobile, AL, USA", code: "USMOB" },
  
  // USA - Mississippi
  { value: "Gulfport, MS, USA", code: "USGPT" },
  { value: "Pascagoula, MS, USA", code: "USPGL" },
  
  // USA - Louisiana
  { value: "New Orleans, LA, USA", code: "USMSY" },
  { value: "Baton Rouge, LA, USA", code: "USBTR" },
  { value: "Lake Charles, LA, USA", code: "USLCH" },
  { value: "Morgan City, LA, USA", code: "USMCZ" },
  { value: "Port Fourchon, LA, USA", code: "USPFO" },
  { value: "Port Sulphur, LA, USA", code: "USPSU" },
  
  // USA - Texas
  { value: "Houston, TX, USA", code: "USHOU" },
  { value: "Galveston, TX, USA", code: "USGLS" },
  { value: "Texas City, TX, USA", code: "USTXC" },
  { value: "Freeport, TX, USA", code: "USFPT" },
  { value: "Corpus Christi, TX, USA", code: "USCRP" },
  { value: "Port Arthur, TX, USA", code: "USPAR" },
  { value: "Beaumont, TX, USA", code: "USBPT" },
  { value: "Brownsville, TX, USA", code: "USBRO" },
  { value: "Port Lavaca, TX, USA", code: "USPLV" },
  { value: "Port Isabel, TX, USA", code: "USPIS" },
  
  // USA - Massachusetts
  { value: "Boston, MA, USA", code: "USBOS" },
  { value: "New Bedford, MA, USA", code: "USEWB" },
  { value: "Fall River, MA, USA", code: "USFAL" },
  
  // USA - Rhode Island
  { value: "Providence, RI, USA", code: "USPVD" },
  { value: "Newport, RI, USA", code: "USNWP" },
  
  // USA - Connecticut
  { value: "New Haven, CT, USA", code: "USHVN" },
  { value: "Bridgeport, CT, USA", code: "USBDR" },
  { value: "New London, CT, USA", code: "USNWL" },
  
  // USA - Maine
  { value: "Portland, ME, USA", code: "USPWM" },
  { value: "Searsport, ME, USA", code: "USSRS" },
  { value: "Eastport, ME, USA", code: "USEAS" },
  
  // USA - New Hampshire
  { value: "Portsmouth, NH, USA", code: "USPSM" },
  
  // USA - Vermont
  { value: "Burlington, VT, USA", code: "USBVT" },
  
  // USA - Michigan
  { value: "Detroit, MI, USA", code: "USDET" },
  { value: "Port Huron, MI, USA", code: "USPHU" },
  { value: "Sault Ste. Marie, MI, USA", code: "USSSM" },
  { value: "Muskegon, MI, USA", code: "USMKG" },
  { value: "Grand Haven, MI, USA", code: "USGHV" },
  
  // USA - Ohio
  { value: "Cleveland, OH, USA", code: "USCLE" },
  { value: "Toledo, OH, USA", code: "USTOL" },
  { value: "Ashtabula, OH, USA", code: "USAHB" },
  { value: "Lorain, OH, USA", code: "USLOR" },
  
  // USA - Indiana
  { value: "Burns Harbor, IN, USA", code: "USBHB" },
  { value: "Portage, IN, USA", code: "USPTG" },
  { value: "Gary, IN, USA", code: "USGRY" },
  
  // USA - Illinois
  { value: "Chicago, IL, USA", code: "USCHI" },
  
  // USA - Wisconsin
  { value: "Milwaukee, WI, USA", code: "USMKE" },
  { value: "Green Bay, WI, USA", code: "USGRB" },
  { value: "Superior, WI, USA", code: "USSUW" },
  
  // USA - Minnesota
  { value: "Duluth, MN, USA", code: "USDLH" },
  
  // USA - Guam & Territories
  { value: "Guam", code: "GUGUM" },
  { value: "San Juan, PR, USA", code: "USSJU" },
  { value: "Ponce, PR, USA", code: "USPSE" },
  { value: "Mayaguez, PR, USA", code: "USMAZ" },
  { value: "Charlotte Amalie, VI, USA", code: "VISTT" },
  { value: "Christiansted, VI, USA", code: "VISTX" },
  { value: "Pago Pago, AS, USA", code: "ASPPG" },
  
  // Europe
  { value: "Rotterdam, Netherlands", code: "NLRTM" },
  { value: "Amsterdam, Netherlands", code: "NLAMS" },
  { value: "Hamburg, Germany", code: "DEHAM" },
  { value: "Antwerp, Belgium", code: "BEANR" },
  { value: "Bremerhaven, Germany", code: "DEBRV" },
  { value: "Felixstowe, UK", code: "GBFXT" },
  { value: "Southampton, UK", code: "GBSOU" },
  { value: "London Gateway, UK", code: "GBLGP" },
  { value: "Liverpool, UK", code: "GBLIV" },
  { value: "Le Havre, France", code: "FRLEH" },
  { value: "Marseille, France", code: "FRMRS" },
  { value: "Dunkirk, France", code: "FRDKK" },
  { value: "Valencia, Spain", code: "ESVLC" },
  { value: "Barcelona, Spain", code: "ESBCN" },
  { value: "Algeciras, Spain", code: "ESALG" },
  { value: "Bilbao, Spain", code: "ESBIO" },
  { value: "Piraeus, Greece", code: "GRPIR" },
  { value: "Genoa, Italy", code: "ITGOA" },
  { value: "La Spezia, Italy", code: "ITLSP" },
  { value: "Naples, Italy", code: "ITNAP" },
  { value: "Gioia Tauro, Italy", code: "ITGIT" },
  { value: "Lisbon, Portugal", code: "PTLIS" },
  { value: "Sines, Portugal", code: "PTSIN" },
  { value: "Gdansk, Poland", code: "PLGDN" },
  { value: "Istanbul, Turkey", code: "TRIST" },
  { value: "Izmir, Turkey", code: "TRAYT" },
  { value: "Mersin, Turkey", code: "TRMER" },
  { value: "Constanta, Romania", code: "ROCND" },
  { value: "Odessa, Ukraine", code: "UAODS" },
  { value: "St. Petersburg, Russia", code: "RULED" },
  
  // Southeast Asia
  { value: "Singapore", code: "SGSIN" },
  { value: "Port Klang, Malaysia", code: "MYPKG" },
  { value: "Tanjung Pelepas, Malaysia", code: "MYTPP" },
  { value: "Penang, Malaysia", code: "MYPEN" },
  { value: "Johor Bahru, Malaysia", code: "MYJHB" },
  { value: "Bangkok, Thailand", code: "THBKK" },
  { value: "Laem Chabang, Thailand", code: "THLCH" },
  { value: "Jakarta, Indonesia", code: "IDJKT" },
  { value: "Surabaya, Indonesia", code: "IDSUB" },
  { value: "Belawan, Indonesia", code: "IDBEW" },
  { value: "Manila, Philippines", code: "PHMNL" },
  { value: "Subic Bay, Philippines", code: "PHSFS" },
  { value: "Ho Chi Minh City, Vietnam", code: "VNSGN" },
  { value: "Haiphong, Vietnam", code: "VNHPH" },
  { value: "Da Nang, Vietnam", code: "VNDAD" },
  { value: "Yangon, Myanmar", code: "MMRGN" },
  { value: "Phnom Penh, Cambodia", code: "KHPNH" },
  
  // Middle East
  { value: "Jebel Ali, UAE", code: "AEJEA" },
  { value: "Dubai, UAE", code: "AEDXB" },
  { value: "Abu Dhabi, UAE", code: "AEAUH" },
  { value: "Jeddah, Saudi Arabia", code: "SAJED" },
  { value: "Dammam, Saudi Arabia", code: "SADAM" },
  { value: "King Abdullah, Saudi Arabia", code: "SAKAC" },
  { value: "Doha, Qatar", code: "QADOH" },
  { value: "Kuwait City, Kuwait", code: "KWKWI" },
  { value: "Muscat, Oman", code: "OMMCT" },
  { value: "Salalah, Oman", code: "OMSLL" },
  { value: "Sohar, Oman", code: "OMSOH" },
  { value: "Manama, Bahrain", code: "BHBAH" },
  { value: "Aqaba, Jordan", code: "JOAQJ" },
  { value: "Beirut, Lebanon", code: "LBBEY" },
  { value: "Haifa, Israel", code: "ILHFA" },
  { value: "Ashdod, Israel", code: "ILASD" },
  
  // South Asia
  { value: "Mumbai, India", code: "INBOM" },
  { value: "Chennai, India", code: "INMAA" },
  { value: "Nhava Sheva, India", code: "INNSA" },
  { value: "Kolkata, India", code: "INCCU" },
  { value: "Cochin, India", code: "INCOK" },
  { value: "Tuticorin, India", code: "INTUT" },
  { value: "Vishakhapatnam, India", code: "INVTZ" },
  { value: "Colombo, Sri Lanka", code: "LKCMB" },
  { value: "Karachi Port", code: "PKKHI" },
  { value: "Port Muhammad Bin Qasim", code: "PKQCT" },
  { value: "Gwadar Port", code: "PKGWD" },
  { value: "Chittagong, Bangladesh", code: "BDCGP" },
  { value: "Dhaka, Bangladesh", code: "BDDAC" },
  
  // East Asia
  { value: "Busan, South Korea", code: "KRPUS" },
  { value: "Incheon, South Korea", code: "KRINC" },
  { value: "Gwangyang, South Korea", code: "KRKUV" },
  { value: "Tokyo, Japan", code: "JPTYO" },
  { value: "Yokohama, Japan", code: "JPYOK" },
  { value: "Kobe, Japan", code: "JPUKB" },
  { value: "Osaka, Japan", code: "JPOSA" },
  { value: "Nagoya, Japan", code: "JPNGO" },
  { value: "Hakata, Japan", code: "JPFUK" },
  { value: "Kaohsiung, Taiwan", code: "TWKHH" },
  { value: "Taichung, Taiwan", code: "TWTXG" },
  { value: "Keelung, Taiwan", code: "TWKEL" },
  
  // Australia
  { value: "Sydney, Australia", code: "AUSYD" },
  { value: "Melbourne, Australia", code: "AUMEL" },
  { value: "Brisbane, Australia", code: "AUBNE" },
  
  // South America
  { value: "Santos, Brazil", code: "BRSSZ" },
  { value: "Rio de Janeiro, Brazil", code: "BRRIO" },
  { value: "Paranaguá, Brazil", code: "BRPNG" },
  { value: "Itajaí, Brazil", code: "BRITJ" },
  { value: "Salvador, Brazil", code: "BRSSA" },
  { value: "Manaus, Brazil", code: "BRMAO" },
  { value: "Buenos Aires, Argentina", code: "ARBUE" },
  { value: "Montevideo, Uruguay", code: "UYMVD" },
  { value: "Callao, Peru", code: "PECLL" },
  { value: "Cartagena, Colombia", code: "COCTG" },
  { value: "Buenaventura, Colombia", code: "COBUN" },
  { value: "Guayaquil, Ecuador", code: "ECGYE" },
  { value: "Valparaíso, Chile", code: "CLVAP" },
  { value: "San Antonio, Chile", code: "CLSAI" },
  { value: "Cristóbal, Panama", code: "PACRQ" },
  { value: "Balboa, Panama", code: "PABLB" },
  { value: "Puerto Cabello, Venezuela", code: "VEPCB" },
  { value: "La Guaira, Venezuela", code: "VELGR" },
  
  // Africa
  { value: "Port Said, Egypt", code: "EGPSD" },
  { value: "Alexandria, Egypt", code: "EGALY" },
  { value: "Damietta, Egypt", code: "EGDAM" },
  { value: "Suez, Egypt", code: "EGSUZ" },
  { value: "Durban, South Africa", code: "ZADUR" },
  { value: "Cape Town, South Africa", code: "ZACPT" },
  { value: "Port Elizabeth, South Africa", code: "ZAPEZ" },
  { value: "Lagos, Nigeria", code: "NGLOS" },
  { value: "Apapa, Nigeria", code: "NGAPP" },
  { value: "Tin Can Island, Nigeria", code: "NGTCI" },
  { value: "Mombasa, Kenya", code: "KEMBA" },
  { value: "Dar es Salaam, Tanzania", code: "TZDAR" },
  { value: "Djibouti", code: "DJJIB" },
  { value: "Abidjan, Ivory Coast", code: "CIABJ" },
  { value: "Tema, Ghana", code: "GHTEM" },
  { value: "Takoradi, Ghana", code: "GHTKD" },
  { value: "Lomé, Togo", code: "TGLFW" },
  { value: "Cotonou, Benin", code: "BJCOO" },
  { value: "Luanda, Angola", code: "AOLAD" },
  { value: "Maputo, Mozambique", code: "MZMPM" },
  { value: "Casablanca, Morocco", code: "MACAS" },
  { value: "Tangier, Morocco", code: "MATNG" },
  { value: "Algiers, Algeria", code: "DZALG" },
  { value: "Tunis, Tunisia", code: "TNTUN" },
  { value: "Tripoli, Libya", code: "LYTIP" },
  
  // Canada
  { value: "Vancouver, BC, Canada", code: "CAVAN" },
  { value: "Prince Rupert, BC, Canada", code: "CAPRR" },
  { value: "Montreal, QC, Canada", code: "CAMTR" },
  { value: "Halifax, NS, Canada", code: "CAHAL" },
  { value: "Toronto, ON, Canada", code: "CATOR" },
  { value: "Saint John, NB, Canada", code: "CASJF" },
  
  // Central America & Caribbean
  { value: "Veracruz, Mexico", code: "MXVER" },
  { value: "Manzanillo, Mexico", code: "MXZLO" },
  { value: "Lázaro Cárdenas, Mexico", code: "MXLZC" },
  { value: "Altamira, Mexico", code: "MXATM" },
  { value: "Kingston, Jamaica", code: "JMKIN" },
  { value: "Freeport, Bahamas", code: "BSFPO" },
  { value: "Santo Domingo, Dominican Republic", code: "DOSDQ" },
  { value: "Port-au-Prince, Haiti", code: "HTPAP" },
  { value: "Havana, Cuba", code: "CUHAV" },
  { value: "Port of Spain, Trinidad", code: "TTPOS" },
  { value: "Georgetown, Guyana", code: "GYGEO" },
];

interface PortComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  testId?: string;
  usaOnly?: boolean;
}

export function PortCombobox({ 
  value, 
  onChange, 
  placeholder = "Select port",
  testId = "combobox-port",
  usaOnly = false
}: PortComboboxProps) {
  const [open, setOpen] = useState(false);

  // Filter ports based on usaOnly prop
  const filteredPorts = usaOnly 
    ? MAJOR_PORTS.filter(port => port.code.startsWith('US') || port.code.startsWith('GU') || port.code.startsWith('VI') || port.code.startsWith('AS'))
    : MAJOR_PORTS;

  const selectedPort = filteredPorts.find((port) => port.value === value);
  const displayValue = selectedPort 
    ? `${selectedPort.value} (${selectedPort.code})`
    : value || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground"
          )}
          data-testid={testId}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search ports..." />
          <CommandList>
            <CommandEmpty>No port found.</CommandEmpty>
            <CommandGroup>
              {filteredPorts.map((port) => (
                <CommandItem
                  key={port.value}
                  value={`${port.value} ${port.code}`}
                  onSelect={() => {
                    onChange(port.value);
                    setOpen(false);
                  }}
                  data-testid={`port-option-${port.code.toLowerCase()}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === port.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1">{port.value}</span>
                  <span className="text-xs text-muted-foreground ml-2">{port.code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
