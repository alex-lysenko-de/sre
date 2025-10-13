<script setup lang="ts">
// TODO: Implement ArmbandConnectView. Please use the same form as in GroupEditView - Kind add / edit
// 1. search a kind by band_id
// select * from children where band_id = :band_id
// 2. if a kind gefunden ist:
// redirect to the form ChildDetailView with the kind_id
// router.push({ name: 'ChildDetail', params: { id: child_id } })
// 3. else (if no kind gefunden ist:
// - display a message "Armband ist noch mit keinem Kind verknüpft, Verbinden? " (buttons "Ja" / "Nein")
// - if user clicks "Nein", redirect to HomeView
// router.push({ name: 'Home' })
// - if user clicks "Ja":
// - check if user in einer gruppe heute angemeldet ist . if group_id is null, show message "Sie müssen sich zuerst in einer Gruppe anmelden" End
// redirect to /armband-connect/:band_id
// router.push({ name: 'ArmBandConnect', params: { band_id: band_id} })

</script>

<template>
<!--  TODO: Implement  View. Please use a similar form as in GroupEditView -->
  <div class="container my-4">
    <div class="row justify-content-center">
      <div class="col-md-8 col-lg-6">
        <div class="card shadow-sm">
          <div class="card-body">
            <h3 class="card-title mb-4">Armband Verbinden</h3>
          </div>
        </div>
      </div>
    </div>
  </div>



</template>

<style scoped>

</style>