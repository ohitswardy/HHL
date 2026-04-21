<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;

class AuditService
{
    /**
     * Log an auditable action.
     *
     * @param string     $action    e.g. 'created', 'updated', 'deleted', 'login', 'permissions_updated'
     * @param string     $tableName The DB table / resource name, e.g. 'users', 'roles'
     * @param int|null   $recordId  Primary key of the affected record
     * @param array|null $oldValue  State before the change
     * @param array|null $newValue  State after the change
     */
    public static function log(
        string $action,
        string $tableName,
        ?int $recordId = null,
        ?array $oldValue = null,
        ?array $newValue = null
    ): void {
        AuditLog::create([
            'user_id'    => Auth::id(),
            'action'     => $action,
            'table_name' => $tableName,
            'record_id'  => $recordId,
            'old_value'  => $oldValue,
            'new_value'  => $newValue,
            'ip_address' => request()->ip(),
            'branch_id'  => config('app.default_branch_id'),
        ]);
    }
}
