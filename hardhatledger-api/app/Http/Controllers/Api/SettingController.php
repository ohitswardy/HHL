<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    /**
     * Return all settings as a key → value map.
     */
    public function index(): JsonResponse
    {
        $settings = Setting::all()->mapWithKeys(fn ($s) => [
            $s->key => [
                'value'       => $s->value,
                'label'       => $s->label,
                'description' => $s->description,
            ],
        ]);

        return response()->json(['data' => $settings]);
    }

    /**
     * Update a single setting by key.
     */
    public function update(Request $request, string $key): JsonResponse
    {
        $request->validate([
            'value' => ['required'],
        ]);

        $setting = Setting::findOrFail($key);
        $setting->value = $request->value;
        $setting->save();

        return response()->json([
            'data'    => [
                'key'         => $setting->key,
                'value'       => $setting->value,
                'label'       => $setting->label,
                'description' => $setting->description,
            ],
            'message' => 'Setting updated successfully.',
        ]);
    }
}
