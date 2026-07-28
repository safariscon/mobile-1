const slug = (label) => label.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const SERVICE_CATEGORY_LABELS = [
  'Hotel rooms', 'Resort', 'Motel', 'Hostel', 'Bed & Breakfast / B&B', 'Inn', 'Boutique Hotel',
  'Apartment Hotel / Serviced Apartment', 'Villa / Chalet / Cabin', 'Glamping Site', 'Campsite / RV Park',
  'Capsule Hotel', 'Eco-Lodge', 'Farm Stay', 'Casino Hotel', 'Guesthouse / Pension', 'Apartments',
  'Homestay', 'Tent Rentals', 'Coffee Experience', 'Tea Experience', 'Traditional Food Experience',
  'Traditional Beer Experience', 'Culture Center', 'Banana Beer Experience', 'Museums', 'Art Gallery',
  'City Tour', 'Street Food Tour', 'Wine Tasting / Vineyard Tour', 'Distillery / Brewery Tour',
  'Hop-On Hop-Off Bus Tour', 'Boat Charter / Canal Cruise', 'Wildlife Safari / Game Drive', 'Eco-parks',
  'Scuba Diving / Snorkeling Charter', 'Adventure Experiences', 'Historical / Archeological Site',
  'Theme Park / Water Park', 'Performance / Theater Show', 'Wellness / Yoga Retreat', 'Village Walks',
  'Hiking Experiences', 'Voluntourism', 'Cow Milking Experiences', 'Commercial Airline',
  'Charter / Private Jet', 'Airport Shuttle / Transfer', 'Car Rental', 'Campervan / RV Rental',
  'Rideshare / Taxi Stand', 'Scooter / Bicycle Share', 'Intercity Coach Bus', 'Scenic / Heritage Train',
  'Ferry / Hydrofoil', 'Water Boat Taxi', 'Motorbike Rentals', 'Convention / Exhibition Center',
  'Hotel Ballroom / Banquet Hall', 'Co-working / Meeting Room', 'Rooftop Terrace',
  'Historic Estate / Castle', 'Retreat Center', 'Fine Dining Restaurant', 'Casual Dining Restaurant',
  'Bistro / Brasserie', 'Cafe / Coffee Shop', 'Bakery / Patisserie', 'Food Truck / Mobile Kiosk',
  'Food Court / Food Hall', 'Pizzeria', 'Steakhouse', 'Buffet / Cafeteria', 'Sandwich Shop',
  'Pub / Tavern', 'Cocktail Lounge', 'Speakeasy', 'Rooftop Bar', 'Wine Bar', 'Sports Bar',
  'Nightclub / Discotheque', 'Beach Club / Tiki Bar', 'Microbrewery / Taproom', 'Dive Bar',
  'Karaoke Bar', 'Arcade / Board Game Bar', 'Liquor Store', 'Travel Agency Storefront',
  'Destination Management Company / DMC', 'Souvenir / Gift Shop', 'Artisan / Craft Market',
  'Duty-Free Airport Shop', 'Day Spa / Wellness Center', 'Luggage Storage Shop / Locker',
  'Information Desks', 'Foreign Exchange / FX Booth', 'Gear Rental Shop', 'Freelancer Guides',
  'Travel Insurance Agency',
];

export const SERVICE_CATEGORY_OPTIONS = SERVICE_CATEGORY_LABELS.map((label) => [slug(label), label]);

export const RWANDA_PROVINCES = ['', 'Kigali City', 'Northern Province', 'Southern Province', 'Eastern Province', 'Western Province'];

export const RWANDA_DISTRICTS = [
  'Bugesera', 'Burera', 'Gakenke', 'Gasabo', 'Gatsibo', 'Gicumbi', 'Gisagara', 'Huye', 'Kamonyi', 'Karongi',
  'Kayonza', 'Kicukiro', 'Kirehe', 'Muhanga', 'Musanze', 'Ngoma', 'Ngororero', 'Nyabihu', 'Nyagatare', 'Nyamagabe',
  'Nyamasheke', 'Nyanza', 'Nyarugenge', 'Nyaruguru', 'Rubavu', 'Ruhango', 'Rulindo', 'Rusizi', 'Rutsiro', 'Rwamagana',
];
