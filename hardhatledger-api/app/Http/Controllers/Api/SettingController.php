<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\AuditService;
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
        $oldValue = $setting->value;
        $setting->value = $request->value;
        $setting->save();

        AuditService::log('updated', 'settings', null, [
            'key'   => $setting->key,
            'value' => $oldValue,
        ], [
            'key'   => $setting->key,
            'value' => $setting->value,
        ]);

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
