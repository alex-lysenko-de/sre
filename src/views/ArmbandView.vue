<script setup lang="ts">
// TODO: Implement ArmbandConnectView.
// 1. search a kind by band_id
// select * from children where band_id = :band_id
// 2. if a kind gefunden ist:
// redirect to the form ChildDetailView with the kind_id
// router.push({ name: 'ChildDetail', params: { id: child_id } })
// 3. else (if no kind gefunden ist:
// - display a message "Armband ist noch mit keinem Kind verknüpft, Verbinden? " (buttons "Ja" / "Nein")
// - if user clicks "Nein", redirect to Home view
// router.push({ name: 'Home' })
// - if user clicks "Ja":
// - check if user in einer gruppe heute angemeldet ist . if group_id is null, show message "Sie müssen sich zuerst in einer Gruppe anmelden" return
// - if user in einer gruppe heute angemeldet ist, show a list of kinder in der gruppe (see SelectChildView component)
// - allow user to select ein kind from the list. Wenn ein kind selected ist, show a button "Armband mit Kind verknüpfen"
// - bei Bedarf User can create a new kind (show a button "Neues Kind anlegen" which opens a modal with the same form as in ChildDetailView)
// - when user selects a kind and clicks "Armband mit Kind verknüpfen", update the child's band_id in the database
// update children set band_id =  :band_id where id = :child_id
// - show a success message "Armband erfolgreich mit Kind verknüpft"

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