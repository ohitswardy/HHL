<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Client;
use App\Models\ClientTier;
use App\Models\User;
use Illuminate\Database\Seeder;

class DefaultDataSeeder extends Seeder
{
    public function run(): void
    {
        // Client Tiers
        $retail = ClientTier::create([
            'name' => 'Retail',
            'discount_percent' => 0,
            'markup_percent' => 0,
            'description' => 'Walk-in retail customers, standard pricing',
        ]);

        $wholesale = ClientTier::create([
            'name' => 'Wholesale',
            'discount_percent' => 10,
            'markup_percent' => 0,
            'description' => 'Wholesale hardware store buyers',
        ]);

        $contractor = ClientTier::create([
            'name' => 'Contractor',
            'discount_percent' => 15,
            'markup_percent' => 0,
            'description' => 'Licensed contractors with regular orders',
        ]);

        $vip = ClientTier::create([
            'name' => 'VIP',
            'discount_percent' => 20,
            'markup_percent' => 0,
            'description' => 'Long-term high-volume partners',
        ]);

        // Default walk-in client
        Client::create([
            'business_name' => 'Walk-in Customer',
            'contact_person' => 'N/A',
            'client_tier_id' => $retail->id,
            'credit_limit' => 0,
        ]);

        // Product Categories
        $categories = [
            'Cement & Concrete' => ['Portland Cement', 'Ready Mix', 'Concrete Blocks'],
            'Steel & Metal' => ['Rebar', 'Steel Bars', 'GI Sheets', 'Metal Roofing'],
            'Lumber & Wood' => ['Plywood', 'Hardwood', 'Coco Lumber'],
            'Roofing' => ['Corrugated Sheets', 'Ridge Caps', 'Roof Accessories'],
            'Plumbing' => ['PVC Pipes', 'Fittings', 'Valves', 'Water Tanks'],
            'Electrical' => ['Wires', 'Switches', 'Circuit Breakers', 'Conduits'],
            'Paint & Finishes' => ['Interior Paint', 'Exterior Paint', 'Primers', 'Thinners'],
            'Tools & Hardware' => ['Hand Tools', 'Power Tools', 'Fasteners', 'Safety Gear'],
            'Sand & Gravel' => ['Fine Sand', 'Coarse Sand', 'Gravel'],
            'Tiles & Flooring' => ['Floor Tiles', 'Wall Tiles', 'Adhesives'],
        ];

        foreach ($categories as $parentName => $children) {
            $parent = Category::create(['name' => $parentName]);
            foreach ($children as $childName) {
                Category::create(['name' => $childName, 'parent_id' => $parent->id]);
            }
        }

        // Default Users
        $superAdmin = User::create([
            'name' => 'System Admin',
            'email' => 'admin@hardhatledger.com',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);
        $superAdmin->assignRole('Super Admin');

        $manager = User::create([
            'name' => 'Manager',
            'email' => 'manager@hardhatledger.com',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);
        $manager->assignRole('Manager');

        $admin = User::create([
            'name' => 'Admin Staff',
            'email' => 'staff@hardhatledger.com',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);
        $admin->assignRole('Admin');

        $clerk1 = User::create([
            'name' => 'Sales Clerk 1',
            'email' => 'clerk1@hardhatledger.com',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);
        $clerk1->assignRole('Sales Clerk');

        $clerk2 = User::create([
            'name' => 'Sales Clerk 2',
            'email' => 'clerk2@hardhatledger.com',
            'password' => bcrypt('password'),
            'is_active' => true,
        ]);
        $clerk2->assignRole('Sales Clerk');
    }
}
