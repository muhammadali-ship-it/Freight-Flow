# Script to add automatic hold removal on gate out in routes.ts

$file = "c:\Users\Muhammad Ali\Desktop\code\Freight\Freight-Flow\server\routes.ts"
$content = [System.IO.File]::ReadAllText($file)

# Find and replace the terminalHolds handling section
$oldPattern = @'
        // Handle terminalHolds array
        if (terminalHolds !== undefined) {
          updatedRawData.terminalHolds = terminalHolds;
        }
'@

$newPattern = @'
        // Handle terminalHolds array
        if (terminalHolds !== undefined) {
          // Check if Full Container Gate Out event exists
          const existingRawData = cargoesFlowShipment.rawData as any || {};
          const events = existingRawData.shipmentEvents || existingRawData.milestones || existingRawData.events || [];
          const hasGateOut = events.some((e: any) => 
            e.code === 'gateOutWithContainerFull' && e.actualTime
          );
          
          // If gate out occurred, clear all holds regardless of input
          updatedRawData.terminalHolds = hasGateOut ? [] : terminalHolds;
        }
'@

$content = $content.Replace($oldPattern, $newPattern)

# Save the file
[System.IO.File]::WriteAllText($file, $content)

Write-Host "Successfully updated routes.ts - backend hold removal logic added"
